import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Admissions() {
  return (
    <div className="w-full bg-slate-50 py-12">
      <div className="max-w-5xl mx-auto px-4">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">Admission Process 2025</h2>
          <p className="text-slate-600">Follow these 4 simple steps to join our academic community.<br/>Applications are now open for the upcoming academic year.</p>
        </div>

        {/* Process Steps */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-6 left-12 right-12 h-0.5 bg-teal-200 z-0"></div>
          
          {[
            { step: 1, title: 'Register Online', desc: 'Create an account and fill out the admission form with your details.' },
            { step: 2, title: 'Document Verification', desc: 'Visit the school office with original documents for verification.' },
            { step: 3, title: 'Fee Payment', desc: 'Pay the admission fee at J&K Bank using the challan provided.' },
            { step: 4, title: 'Final Enrollment', desc: 'Receive your Roll Number and ID Card to complete enrollment.' }
          ].map((item) => (
            <div key={item.step} className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full border-4 border-white bg-teal-50 shadow-md flex items-center justify-center mb-4 text-teal-700 font-bold text-xl ring-2 ring-teal-200">
                {item.step}
              </div>
              <h4 className="font-bold text-slate-800 mb-2">{item.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed px-2">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Required Documents Section */}
        <div className="bg-teal-50/50 p-8 rounded-xl border border-teal-100 mb-12">
          <h3 className="text-xl font-bold text-teal-800 mb-6 text-center">Documents Required</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded shadow-sm border border-slate-100 flex items-start">
              <CheckCircle className="text-teal-500 mr-3 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-slate-700">Discharge and character certificates in original.</p>
            </div>
            <div className="bg-white p-4 rounded shadow-sm border border-slate-100 flex items-start">
              <CheckCircle className="text-teal-500 mr-3 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-slate-700">One photostat each of Marks card, Aadhar card, Ration card and Bank passbook.</p>
            </div>
            <div className="bg-white p-4 rounded shadow-sm border border-slate-100 flex items-start">
              <CheckCircle className="text-teal-500 mr-3 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-slate-700">Category certificate (if any).</p>
            </div>
          </div>
        </div>

        {/* Fee Structure Table */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 mb-12">
          <h3 className="text-xl font-bold text-teal-800 mb-2 text-center">Fee Structure (Session 2025)</h3>
          <div className="h-1 w-16 bg-teal-500 mx-auto mb-8 rounded"></div>

          {/* 11th & 12th */}
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm text-center border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-900 text-white p-3 w-1/5 border border-slate-800" rowSpan={2}>Class</th>
                  <th className="bg-orange-500 text-white p-3 border border-orange-600" colSpan={2}>Science</th>
                  <th className="bg-blue-500 text-white p-3 border border-blue-600" colSpan={2}>Humanities</th>
                </tr>
                <tr className="bg-slate-100 text-slate-600 text-xs font-bold uppercase">
                  <th className="p-3 border border-slate-300">Boys</th>
                  <th className="p-3 border border-slate-300">Girls</th>
                  <th className="p-3 border border-slate-300">Boys</th>
                  <th className="p-3 border border-slate-300">Girls</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-4 font-bold border border-slate-200">11th</td>
                  <td className="p-4 border border-slate-200 text-slate-600">Rs. 1900</td>
                  <td className="p-4 border border-slate-200 text-slate-600">Rs. 1700</td>
                  <td className="p-4 border border-slate-200 text-slate-600">Rs. 1800</td>
                  <td className="p-4 border border-slate-200 text-slate-600">Rs. 1600</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="p-4 font-bold border border-slate-200">12th</td>
                  <td className="p-4 border border-slate-200 text-slate-600">Rs. 1650</td>
                  <td className="p-4 border border-slate-200 text-slate-600">Rs. 1650</td>
                  <td className="p-4 border border-slate-200 text-slate-600">Rs. 1550</td>
                  <td className="p-4 border border-slate-200 text-slate-600">Rs. 1550</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 className="text-center font-bold text-slate-500 mb-4">Secondary Level (Boys Only)</h4>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm text-center border-collapse max-w-2xl mx-auto">
              <thead>
                <tr>
                  <th className="bg-slate-900 text-white p-3 w-1/2 border border-slate-800">Class</th>
                  <th className="bg-slate-500 text-white p-3 w-1/2 border border-slate-600">Fee</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-4 font-bold border border-slate-200">9th</td>
                  <td className="p-4 border border-slate-200 text-slate-600">Rs. 1700</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="p-4 font-bold border border-slate-200">10th</td>
                  <td className="p-4 border border-slate-200 text-slate-600">Rs. 1700</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="text-center">
            <Link to="/academics" className="inline-block bg-slate-700 hover:bg-slate-800 text-white px-6 py-2 rounded-full font-semibold transition-colors shadow-md text-sm">
              View Subject Combinations
            </Link>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center pb-12">
           <button className="bg-teal-700 hover:bg-teal-800 text-white text-lg px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105 shadow-xl">
              Register to Apply Online
           </button>
        </div>

      </div>
    </div>
  );
}

