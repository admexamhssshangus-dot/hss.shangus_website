import React from 'react';
import { ShieldCheck, Mail, Lock, CheckCircle2 } from 'lucide-react';
import SEO from '../components/SEO';

export default function PrivacyPolicy() {
  return (
    <div className="w-full bg-slate-50 min-h-screen py-10 sm:py-14 text-slate-700">
      <SEO 
        title="Privacy Policy" 
        description="Privacy Policy for Govt. Higher Secondary School Shangus. Learn how we handle student data, online fee payments, and data privacy."
      />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Page Header */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200/80 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center gap-3 text-teal-600 mb-3">
            <ShieldCheck size={28} className="stroke-[2]" />
            <span className="text-xs font-bold uppercase tracking-wider">School Policy</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Govt. Higher Secondary School (HSS) Shangus respects your privacy. This policy explains what information we collect when you use our website, how we use it, and how we keep it safe.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span><strong>Effective Date:</strong> January 1, 2026</span>
            <span><strong>Last Updated:</strong> September 2026</span>
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
              We only collect information necessary for admissions, student records, fee receipts, and general inquiries:
            </p>
            <ul className="space-y-2.5 pl-1">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-teal-600 mt-1 flex-shrink-0" />
                <span><strong>Student Details:</strong> Full name, parentage, date of birth, gender, category, stream/class applied for, marks, and previous school records.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-teal-600 mt-1 flex-shrink-0" />
                <span><strong>Contact Information:</strong> Phone number, residential address, email address, and emergency contact details.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-teal-600 mt-1 flex-shrink-0" />
                <span><strong>Payment Details:</strong> Order ID, payment date, fee amount, and transaction reference numbers issued by payment gateways.</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="p-5 bg-teal-50/50 rounded-2xl border border-teal-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Lock size={20} className="text-teal-600" />
              Online Payments & Security
            </h2>
            <p className="text-slate-700 mb-3 leading-relaxed">
              Online fee payments on this portal are handled by authorized, secure payment gateways (such as Razorpay and Cashfree).
            </p>
            <div className="bg-white p-4 rounded-xl border border-teal-200/60 text-xs sm:text-sm text-slate-600 space-y-2">
              <p><strong>We do not store your banking data:</strong> Credit/debit card numbers, CVV, net banking passwords, and UPI PINs are entered directly on the payment gateway's encrypted page and are never stored on our school servers.</p>
              <p>All online transactions use standard SSL encryption for security.</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">3</span>
              How We Use Your Information
            </h2>
            <p className="text-slate-600 mb-3">Your information is used strictly for academic and administrative functions:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-800 block mb-1">Admissions & Enrollment:</span>
                Verifying eligibility, assigning roll numbers, and registering students with the school and JKBOSE.
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-800 block mb-1">Fee Receipts:</span>
                Generating official receipts and maintaining transparent fee records.
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-800 block mb-1">School Communication:</span>
                Sending important notices about exams, class schedules, and deadlines.
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-800 block mb-1">Official Records:</span>
                Complying with education department guidelines and audit requirements.
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">4</span>
              Data Protection & Privacy
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We value your trust. We do <strong>not sell, rent, or trade</strong> student or parent personal information to third parties or marketing agencies. Information is shared only with official educational authorities (such as JKBOSE) or payment processors to complete required school services.
            </p>
          </section>

          {/* Section 5 */}
          <section className="pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Mail size={20} className="text-teal-600" />
              Contact Us About Privacy
            </h2>
            <p className="text-slate-600 mb-4">
              If you have questions about your personal data or this policy, please contact our office:
            </p>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-xs sm:text-sm space-y-1.5 text-slate-700">
              <p className="text-slate-900 font-bold text-sm sm:text-base">Govt. Higher Secondary School Shangus</p>
              <p className="text-slate-600">Main Road, Shangus, Anantnag, Jammu & Kashmir - 192201</p>
              <p className="pt-1.5"><strong>Email:</strong> <a href="mailto:adm.exam.hss.shangus@gmail.com" className="text-teal-700 font-bold hover:underline">adm.exam.hss.shangus@gmail.com</a></p>
              <p><strong>Phone:</strong> +91 7006034501 / +91 9682547458</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
