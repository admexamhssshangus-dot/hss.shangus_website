import React from 'react';

export default function Academics() {
  return (
    <div className="w-full bg-slate-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800">Academics</h2>
          <div className="h-1 w-24 bg-teal-600 mx-auto mt-4 rounded"></div>
        </div>

        {/* Departments & Streams Cards */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 mb-8">
          <h3 className="text-xl font-bold text-teal-800 mb-6">Our Departments</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-sm text-slate-600 mb-3 uppercase tracking-wider">Secondary (9th - 10th)</h4>
              <div className="flex flex-wrap gap-2">
                {['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies', 'IT & ITES', 'Healthcare'].map(sub => (
                  <span key={sub} className="bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-md font-medium border border-slate-200">{sub}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-600 mb-3 uppercase tracking-wider">Higher Secondary (11th - 12th)</h4>
              <div className="flex flex-wrap gap-2">
                {['General English', 'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Environmental Science', 'Physical Education', 'IT & ITES', 'Healthcare', 'Education', 'History', 'Political Science', 'Economics', 'Urdu'].map(sub => (
                  <span key={sub} className="bg-teal-50 text-teal-800 text-xs px-3 py-1.5 rounded-md font-medium border border-teal-100">{sub}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Higher Secondary Level Table Structure */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-xl font-bold text-teal-800 mb-2">Higher Secondary Level (11th & 12th)</h3>
          <p className="text-sm text-slate-500 mb-6">Total 5 Subjects Required.</p>

          {/* Science Stream */}
          <div className="mb-10">
            <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Science Stream</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border border-slate-200">
                <thead className="bg-teal-700 text-white">
                  <tr>
                    <th className="px-4 py-3 text-center border-r border-teal-600 w-1/4">Group A (Compulsory)</th>
                    <th className="px-4 py-3 text-center border-r border-teal-600 w-1/4">Group B (Options)</th>
                    <th className="px-4 py-3 text-center border-r border-teal-600 w-2/4">Group C (Options)</th>
                    <th className="px-4 py-3 text-center w-24">Combinations</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-center">
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-4 font-bold text-red-600 border-r border-slate-200">General English, Physics, Chemistry</td>
                    <td className="px-4 py-4 border-r border-slate-200">Biology, Mathematics <br/><span className="text-xs text-slate-400">(Opt 1 or Both)</span></td>
                    <td className="px-4 py-4 text-blue-600 font-medium border-r border-slate-200">Environmental Science / Physical Education / Healthcare / IT and ITES <br/><span className="text-xs text-slate-400">(Opt 1 or None)</span></td>
                    <td className="px-4 py-4"><button className="bg-slate-800 text-white text-xs px-3 py-1 rounded">View List</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-2 italic">Students must choose subjects to total exactly 5. Compulsory (3) + Selections from Group B & C = 5.</p>
          </div>

          {/* Humanities Stream */}
          <div className="mb-10">
            <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Humanities Stream</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border border-slate-200">
                <thead className="bg-teal-700 text-white">
                  <tr>
                    <th className="px-4 py-3 text-center border-r border-teal-600 w-1/4">Group A (Compulsory)</th>
                    <th className="px-4 py-3 text-center border-r border-teal-600 w-2/4">Group B (Options)</th>
                    <th className="px-4 py-3 text-center border-r border-teal-600 w-1/4">Group C (Options)</th>
                    <th className="px-4 py-3 text-center w-24">Combinations</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-center">
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-4 font-bold text-red-600 border-r border-slate-200">General English</td>
                    <td className="px-4 py-4 border-r border-slate-200">Urdu, Education, Economics, History, Political Science, Mathematics <br/><span className="text-xs text-slate-400">(Opt exactly 3)</span></td>
                    <td className="px-4 py-4 text-blue-600 font-medium border-r border-slate-200">Environmental Science / Physical Education / Healthcare / IT and ITES <br/><span className="text-xs text-slate-400">(Opt exactly 1)</span></td>
                    <td className="px-4 py-4"><button className="bg-slate-800 text-white text-xs px-3 py-1 rounded">View List</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-2 italic">Students must choose subjects to total exactly 5. Compulsory (1) + 3 from Group B + 1 from Group C = 5.</p>
          </div>

        </div>
      </div>
    </div>
  );
}

