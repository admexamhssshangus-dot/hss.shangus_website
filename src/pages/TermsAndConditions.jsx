import React from 'react';
import { FileText, ShieldAlert, CreditCard, Scale, CheckCircle2 } from 'lucide-react';
import SEO from '../components/SEO';

export default function TermsAndConditions() {
  return (
    <div className="w-full bg-slate-50 min-h-screen py-10 sm:py-14 text-slate-700">
      <SEO 
        title="Terms and Conditions" 
        description="Terms and Conditions for Govt. Higher Secondary School Shangus. Read guidelines regarding portal use, fee payments, and student admissions."
      />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Page Header */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200/80 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center gap-3 text-teal-600 mb-3">
            <FileText size={28} className="stroke-[2]" />
            <span className="text-xs font-bold uppercase tracking-wider">Portal Terms</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Terms and Conditions
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Welcome to the official website of Govt. Higher Secondary School (HSS) Shangus. By using this website, submitting an admission application, or paying school fees online, you agree to the following terms.
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
              Services Offered
            </h2>
            <p className="text-slate-600 mb-3">
              This website provides online services for students and parents of Govt. HSS Shangus, including:
            </p>
            <ul className="space-y-2.5 pl-1">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-teal-600 mt-1 flex-shrink-0" />
                <span>Online student registration and admission applications for Secondary (9th, 10th) and Higher Secondary (11th, 12th) classes.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-teal-600 mt-1 flex-shrink-0" />
                <span>Online payment of school admission fees and examination fees.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-teal-600 mt-1 flex-shrink-0" />
                <span>Access to official school notices, date sheets, academic circulars, and results.</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <CreditCard size={20} className="text-teal-600" />
              Fees & Payment Terms
            </h2>
            <div className="space-y-3 text-slate-600">
              <p><strong>Currency:</strong> All fees are stated and charged in <strong>Indian Rupees (INR ₹)</strong>.</p>
              <p><strong>Official Fee Rates:</strong> Admission fees for Science, Humanities, and Secondary streams are set according to school education department regulations and are clearly shown during application.</p>
              <p><strong>Payment Confirmation:</strong> A payment is complete only when a valid transaction ID and digital receipt are generated on the portal.</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">3</span>
              Accuracy of Information
            </h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              Students and parents are responsible for providing correct and truthful details (including name, date of birth, previous marks, and category certificates).
            </p>
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs sm:text-sm flex items-start gap-2.5">
              <ShieldAlert size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <span><strong>Please Note:</strong> Submitting fake documents or incorrect marks may lead to cancellation of admission.</span>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">4</span>
              Acceptable Use
            </h2>
            <p className="text-slate-600 mb-2">When using this website, you agree not to:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
              <li>Attempt unauthorized access to administrative or student records.</li>
              <li>Disrupt or overload the website through automated tools.</li>
              <li>Misuse or forge official digital receipts or roll number slips.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">5</span>
              Technical Interruptions
            </h2>
            <p className="text-slate-600 leading-relaxed">
              While we strive to keep the portal available 24/7, the school is not responsible for temporary internet banking delays or banking server downtime. We recommend completing fee payments before the announced deadlines.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Scale size={20} className="text-teal-600" />
              Governing Law & Contact
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              These terms are governed by the laws applicable in the Union Territory of Jammu & Kashmir and India. Any disputes will be addressed under the jurisdiction of courts in District Anantnag, J&K.
            </p>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-700 space-y-1.5">
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
