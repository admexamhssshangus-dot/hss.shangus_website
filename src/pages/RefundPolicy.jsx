import React from 'react';
import { RefreshCw, Clock, CreditCard, HelpCircle, Mail, Phone, CheckCircle2 } from 'lucide-react';
import SEO from '../components/SEO';

export default function RefundPolicy() {
  return (
    <div className="w-full bg-slate-50 min-h-screen py-10 sm:py-14 text-slate-700">
      <SEO 
        title="Refund Policy" 
        description="Refund Policy for Govt. Higher Secondary School Shangus. Learn about eligible fee refunds, duplicate payments, and the 5-7 working days refund process."
      />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Page Header */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200/80 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center gap-3 text-teal-600 mb-3">
            <RefreshCw size={28} className="stroke-[2]" />
            <span className="text-xs font-bold uppercase tracking-wider">Fee Refunds</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Refund & Cancellation Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            This policy explains when and how refunds are issued for online fee payments made on the Govt. Higher Secondary School (HSS) Shangus portal.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span><strong>Effective Date:</strong> January 1, 2026</span>
            <span><strong>Last Updated:</strong> September 2026</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200/80 space-y-8 text-sm sm:text-base leading-relaxed">
          
          {/* Timeline Highlight Banner */}
          <div className="p-6 rounded-2xl shadow-md border border-teal-700 flex flex-col sm:flex-row items-start sm:items-center gap-4" style={{ backgroundColor: '#0f2922', color: '#ffffff' }}>
            <div className="p-3 bg-teal-600 text-white rounded-xl shadow-sm flex-shrink-0">
              <Clock size={32} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold" style={{ color: '#5eead4' }}>
                Refund Timeline: 5 to 7 Working Days
              </h2>
              <p className="text-xs sm:text-sm mt-1 leading-relaxed" style={{ color: '#ffffff' }}>
                All approved refunds are credited back to the applicant's{' '}
                <strong style={{ color: '#ffffff', fontWeight: '800', textDecoration: 'underline' }}>
                  original bank account / payment method
                </strong>{' '}
                within{' '}
                <strong style={{ color: '#6ee7b7', fontWeight: '800' }}>
                  5 to 7 working days
                </strong>{' '}
                after verification.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">1</span>
              When Can You Get a Refund?
            </h2>
            <p className="text-slate-600 mb-3">
              Refunds are issued under the following circumstances:
            </p>
            
            <div className="space-y-3.5">
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1 text-sm sm:text-base">
                  <CheckCircle2 size={18} className="text-teal-600" />
                  Duplicate Payments
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  If money was deducted more than once for the same admission form due to a network delay or accidental double click, the extra payment will be refunded in full.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1 text-sm sm:text-base">
                  <CheckCircle2 size={18} className="text-teal-600" />
                  Failed or Incomplete Transactions
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  If funds were debited from your account but the website showed an error or did not produce a receipt, payment gateways usually auto-refund within 48 hours. If not, we will process your refund upon receipt of proof.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1 text-sm sm:text-base">
                  <CheckCircle2 size={18} className="text-teal-600" />
                  Application Not Accepted
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  If an application cannot be approved prior to enrollment confirmation, the applicable fee will be refunded according to school rules.
                </p>
              </div>

            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">2</span>
              Non-Refundable Cases
            </h2>
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-slate-700 text-xs sm:text-sm space-y-1.5">
              <p>Once admission is verified and officially confirmed on school records, session admission fees are generally <strong>non-refundable</strong> for that academic year.</p>
              <p>Cancellation requests after roll number allocation are handled as per education department guidelines.</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <CreditCard size={20} className="text-teal-600" />
              Refund Method
            </h2>
            <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-2 text-xs sm:text-sm text-slate-600">
              <p><strong>Original Payment Method:</strong> Refunds are credited directly back to the card, UPI ID, or bank account used during checkout.</p>
              <p><strong>No Cash Refunds:</strong> To maintain transparent accounting records, all online payment refunds are processed electronically.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <HelpCircle size={20} className="text-teal-600" />
              How to Request a Refund
            </h2>
            <p className="text-slate-600 mb-3">
              If you experienced a duplicate payment or failed transaction, please follow these steps:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-slate-600 text-xs sm:text-sm">
              <li>Send an email to <a href="mailto:adm.exam.hss.shangus@gmail.com" className="text-teal-600 font-bold hover:underline">adm.exam.hss.shangus@gmail.com</a> with the subject: <strong>"Refund Request - [Student Name]"</strong>.</li>
              <li>Include:
                <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-500">
                  <li>Student Name and Class</li>
                  <li>Transaction ID / Order ID</li>
                  <li>Date and amount deducted</li>
                  <li>Screenshot or copy of the bank debit message</li>
                </ul>
              </li>
              <li>Our team will verify with the payment records and respond within 24 to 48 business hours.</li>
            </ol>
          </section>

          {/* Contact Section */}
          <section className="pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
              Contact Fee Helpdesk
            </h2>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-xs sm:text-sm space-y-2 text-slate-700">
              <p className="text-slate-900 font-bold text-sm sm:text-base">Govt. Higher Secondary School Shangus</p>
              <p className="text-slate-600">Main Road, Shangus, Anantnag, J&K - 192201</p>
              <div className="pt-1 flex flex-col sm:flex-row gap-3 sm:gap-6 text-slate-700">
                <span className="flex items-center gap-2">
                  <Mail size={16} className="text-teal-600" />
                  <a href="mailto:adm.exam.hss.shangus@gmail.com" className="text-teal-700 font-bold hover:underline">adm.exam.hss.shangus@gmail.com</a>
                </span>
                <span className="flex items-center gap-2">
                  <Phone size={16} className="text-teal-600" />
                  <span className="font-bold text-slate-900">+91 7006034501 / +91 9682547458</span>
                </span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
