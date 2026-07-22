import React from 'react';
import { RefreshCw, Clock, CreditCard, HelpCircle, Mail, Phone, CheckCircle2 } from 'lucide-react';
import SEO from '../components/SEO';

export default function RefundPolicy() {
  return (
    <div className="w-full bg-slate-50 min-h-screen py-10 sm:py-14 text-slate-700">
      <SEO 
        title="Refund & Cancellation Policy" 
        description="Official Refund and Cancellation Policy for Govt. Higher Secondary School Shangus fee payments. Learn about refund eligibility, duplicate payment resolutions, and the 5-7 working days refund timeline."
      />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Page Header */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200/80 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center gap-3 text-teal-600 mb-3">
            <RefreshCw size={28} className="stroke-[2]" />
            <span className="text-xs font-bold uppercase tracking-widest">Mandatory Gateway Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Refund & Cancellation Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
            This policy outlines the guidelines, eligibility criteria, cancellation rules, and refund turnaround timelines for online fee transactions conducted on the Govt. Higher Secondary School Shangus portal.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span><strong>Effective Date:</strong> June 28, 2026</span>
            <span><strong>Last Revised:</strong> July 22, 2026</span>
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
                Standard Refund Processing Timeline
              </h2>
              <p className="text-xs sm:text-sm mt-1 leading-relaxed" style={{ color: '#ffffff' }}>
                All approved refunds for eligible transactions will be credited back to the applicant's{' '}
                <strong style={{ color: '#ffffff', fontWeight: '800', textDecoration: 'underline' }}>
                  original payment method / source bank account
                </strong>{' '}
                within{' '}
                <strong style={{ color: '#6ee7b7', fontWeight: '800' }}>
                  5 to 7 working days
                </strong>{' '}
                from the date of verification.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">1</span>
              Fee Refund Eligibility & Scenarios
            </h2>
            <p className="text-slate-600 mb-3">
              Refunds are strictly governed by institutional guidelines and are applicable under the following specific transaction scenarios:
            </p>
            
            <div className="space-y-4">
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1.5 text-sm sm:text-base">
                  <CheckCircle2 size={18} className="text-teal-600" />
                  A. Duplicate / Multiple Payments
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  If an applicant/parent inadvertently makes duplicate payments for the same student admission form or examination fee due to internet latency or multiple clicks, the excess duplicate amount will be verified and refunded in full.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1.5 text-sm sm:text-base">
                  <CheckCircle2 size={18} className="text-teal-600" />
                  B. Technical Drop / Failed Transactions
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  If money is debited from your bank account or card but the portal displays a transaction failure or fails to generate an admission acknowledgement receipt, the payment gateway (Razorpay / Cashfree) will automatically reconcile the transaction. If un-reconciled within 48 hours, the debited amount will be refunded directly to your source bank account within 5 to 7 working days.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1.5 text-sm sm:text-base">
                  <CheckCircle2 size={18} className="text-teal-600" />
                  C. Application Rejection by Institution
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  In rare cases where an application cannot be accepted due to seat unavailability or administrative decision before enrollment confirmation, refundable components of the session fee will be returned as per school committee guidelines.
                </p>
              </div>

            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-extrabold">2</span>
              Cancellation Policy
            </h2>
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-slate-700 text-xs sm:text-sm space-y-2">
              <p><strong>Admission Registration Fees:</strong> Once an admission application is successfully processed, verified, and confirmed in the school records, the session admission fee is generally <strong>non-refundable and non-transferable</strong> for that academic year.</p>
              <p>Cancellation requests submitted after class roll numbers have been allocated will be processed according to the Department of School Education Kashmir rules.</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <CreditCard size={20} className="text-teal-600" />
              Mode of Refund & Turnaround Time
            </h2>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs sm:text-sm text-slate-600">
              <p><strong>Payment Channel:</strong> All approved refunds will be credited exclusively back to the <strong>original source of payment</strong> (e.g. original Net Banking account, Debit/Credit Card, or UPI ID used during checkout).</p>
              <p><strong>Processing Window:</strong> Refund processing by our accounts office is completed within 2 to 3 business days of approval. Depending on your bank's clearing cycle, funds will reflect in your account within <strong>5 to 7 working days</strong>.</p>
              <p><strong>No Cash Refunds:</strong> In compliance with financial regulations, no cash refunds will be issued for online transactions under any circumstances.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <HelpCircle size={20} className="text-teal-600" />
              How to Claim a Refund
            </h2>
            <p className="text-slate-600 mb-3">
              To request a refund for a duplicate or failed transaction, please submit an official request by following these steps:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-slate-600 text-xs sm:text-sm">
              <li>Send an email to <a href="mailto:adm.exam.hss.shangus@gmail.com" className="text-teal-600 font-bold hover:underline">adm.exam.hss.shangus@gmail.com</a> with the subject line <strong>"Refund Request - [Student Name] - [Transaction ID]"</strong>.</li>
              <li>Provide the following mandatory details in your email:
                <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-500">
                  <li>Full Student Name & Class applied for</li>
                  <li>Payment Gateway Transaction ID / Order ID</li>
                  <li>Bank Reference Number / UTR Number</li>
                  <li>Date and Amount of Transaction</li>
                  <li>Clear screenshot of the payment receipt or bank debit notification</li>
                </ul>
              </li>
              <li>Our Admissions & Examinations accounts team will verify the claim with payment gateway records and update you within 24 to 48 business hours.</li>
            </ol>
          </section>

          {/* Contact Section */}
          <section className="pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
              Need Help with Fee Payments or Refunds?
            </h2>
            <p className="text-slate-600 mb-4 text-xs sm:text-sm">
              If you have any questions regarding pending refunds or fee receipts, reach out to our dedicated accounts helpdesk:
            </p>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-xs sm:text-sm space-y-2 text-slate-700">
              <p className="text-slate-900 font-bold text-sm sm:text-base">Admissions & Examinations Helpdesk</p>
              <p className="text-slate-600">Govt. Higher Secondary School Shangus, Anantnag, J&K - 192201</p>
              <div className="pt-2 flex flex-col sm:flex-row gap-3 sm:gap-6 text-slate-700">
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
