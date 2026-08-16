import React from 'react';
import { ShieldCheck, Mail, Lock, CheckCircle2 } from 'lucide-react';
import SEO from '../components/SEO';

export default function PrivacyPolicy() {
  return (
    <div className="w-full bg-slate-50 min-h-screen py-10 sm:py-14 text-slate-700">
      <SEO 
        title="Privacy Policy" 
        description="Official Privacy Policy for Govt. Higher Secondary School Shangus. Learn how student data, fee transactions, and online security are handled in compliance with payment gateway guidelines."
      />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Page Header */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200/80 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center gap-3 text-teal-600 mb-3">
            <ShieldCheck size={28} className="stroke-[2]" />
            <span className="text-xs font-bold uppercase tracking-widest">Official Policy & Legal Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
            Govt. Higher Secondary School Shangus ("School", "We", "Our", or "Us") is committed to protecting the privacy, confidentiality, and security of all personal and academic data provided by students, parents, guardians, and visitors accessing our online portal.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span><strong>Effective Date:</strong> June 28, 2026</span>
            <span><strong>Last Revised:</strong> July 22, 2026</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200/80 space-y-8 text-sm sm:text-base leading-relaxed">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">1</span>
              Information We Collect
            </h2>
            <p className="text-slate-600 mb-3">
              We collect necessary information strictly required for academic enrollment, fee payments, document verification, and administrative communications:
            </p>
            <ul className="space-y-2 pl-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-teal-600 mt-1 flex-shrink-0" />
                <span><strong>Student Profile Data:</strong> Full Name, Father's Name, Mother's Name, Date of Birth, Gender, Category, Class/Stream, Roll Number, Aadhaar Number, Ration Card details, and Bank account details for official scholarship verification.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-teal-600 mt-1 flex-shrink-0" />
                <span><strong>Contact Information:</strong> Mobile Phone Number, Residential Address, Emergency Contact, and Email Address.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-teal-600 mt-1 flex-shrink-0" />
                <span><strong>Payment & Transaction Information:</strong> Order ID, payment date, transaction status, fee breakdown, and transaction reference numbers issued by payment processors.</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="p-5 bg-teal-50/50 rounded-2xl border border-teal-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Lock size={20} className="text-teal-600" />
              Payment Processing & Third-Party Gateways (Razorpay / Cashfree)
            </h2>
            <p className="text-slate-700 mb-3 leading-relaxed">
              All online fee transactions conducted through our website are securely routed via authorized PCI-DSS compliant third-party payment gateways (including <strong>Razorpay Payments</strong> and <strong>Cashfree Payments</strong>).
            </p>
            <div className="bg-white p-4 rounded-xl border border-teal-200/60 text-xs sm:text-sm text-slate-600 space-y-2">
              <p><strong>Non-Retention of Financial Credentials:</strong> Govt. HSS Shangus does NOT collect, store, view, or process sensitive payment credentials such as Credit/Debit Card Numbers, CVV numbers, Net Banking Passwords, or UPI PINs on our servers.</p>
              <p>All sensitive payment details are entered directly on the secure, encrypted payment gateway server pages protected by standard SSL encryption (256-bit AES encryption).</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">3</span>
              How We Use Collected Information
            </h2>
            <p className="text-slate-600 mb-3">The information collected is used exclusively for legitimate educational and operational purposes, including:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-800">Academic Registration:</span> Processing admission forms, subject selection, roll number assignment, and registration with JKBOSE.
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-800">Fee Receipts:</span> Issuing digital fee receipts, reconciling transaction payments, and tracking fee status.
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-800">Communications:</span> Sending notifications regarding examination dates, fee deadlines, notice board updates, and academic announcements.
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-800">Compliance & Audits:</span> Maintaining official school records required by the Directorate of School Education Kashmir.
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">4</span>
              Data Protection & Zero Commercial Sharing
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We strictly uphold student data confidentiality. We do <strong>NOT sell, rent, lease, or trade</strong> student or user data with third-party marketing agencies or commercial entities under any circumstances. Data is shared only with official educational regulatory authorities (such as JKBOSE) or payment processing partners strictly necessary to fulfill administrative functions.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">5</span>
              Cookies & Local Storage
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Our website uses cookies and web browser local storage solely to manage administrator session authentications, remember user layout preferences, and maintain website stability. You can control or disable cookie settings through your internet browser preferences.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Mail size={20} className="text-teal-600" />
              Privacy Inquiries & Support
            </h2>
            <p className="text-slate-600 mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data security, please contact our Admissions & Examinations Department:
            </p>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-xs sm:text-sm space-y-1.5 text-slate-700">
              <p className="text-slate-900 font-bold text-sm sm:text-base">Govt. Higher Secondary School Shangus</p>
              <p className="font-semibold text-slate-800">Admissions & Examinations Department</p>
              <p className="text-slate-600">Main Road, Shangus, Anantnag, Jammu & Kashmir - 192201</p>
              <p className="pt-2"><strong>Official Email:</strong> <a href="mailto:adm.exam.hss.shangus@gmail.com" className="text-teal-700 font-bold hover:underline">adm.exam.hss.shangus@gmail.com</a></p>
              <p><strong>Helpline Phone:</strong> +91 7006034501 / +91 9682547458</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
