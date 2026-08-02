import React, { useState, useEffect, useCallback } from 'react';
import { Save, Hash, RefreshCw, AlertCircle, CheckCircle2, Wand2 } from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';

export default function RollNoAssignment({ applications = [], onRefresh }) {
  const [selectedClass, setSelectedClass] = useState('12th');
  const [selectedStream, setSelectedStream] = useState('All');
  const [sortBy, setSortBy] = useState('formNo'); // 'formNo' | 'name'
  const [startRollNo, setStartRollNo] = useState('101');

  const [studentList, setStudentList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Filter & Sort Roster
  const prepareRoster = useCallback(() => {
    let filtered = applications.filter((a) => {
      const cls = a['Admission sought for class'] || a['Class'] || '';
      const stream = a['Stream for Class 11th'] || a['Stream'] || '';
      const matchesClass = cls === selectedClass;
      const matchesStream = selectedStream === 'All' || stream === selectedStream;
      return matchesClass && matchesStream;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = (a["Student's Name (as per school records)"] || a["Student's Name"] || a['Full Name'] || a['Name'] || a['Account Name'] || '').toLowerCase();
        const nameB = (b["Student's Name (as per school records)"] || b["Student's Name"] || b['Full Name'] || b['Name'] || b['Account Name'] || '').toLowerCase();
        return nameA.localeCompare(nameB);
      } else {
        const formA = parseInt(a['Form Number'] || a['FormNo'] || a['formNumber'] || 0, 10);
        const formB = parseInt(b['Form Number'] || b['FormNo'] || b['formNumber'] || 0, 10);
        return formA - formB;
      }
    });

    const formatted = filtered.map((a) => ({
      formNo: a['Form Number'] || a['FormNo'] || a['formNumber'] || '',
      name: a["Student's Name (as per school records)"] || a["Student's Name"] || a['Full Name'] || a['Name'] || a['Account Name'] || 'Draft Student',
      class: a['Admission sought for class'] || a['Class'] || '',
      stream: a['Stream for Class 11th'] || a['Stream opted in Class 11th'] || a['Stream'] || '',
      rollNo: a['Class Roll No'] || a['Exam Roll Number of Class 10th'] || a['Exam Roll Number of Class 11th'] || a['RollNo'] || '',
    }));

    setStudentList(formatted);
  }, [applications, selectedClass, selectedStream, sortBy]);

  useEffect(() => {
    prepareRoster();
  }, [prepareRoster]);

  // Handle single roll number edit
  const handleRollNoChange = (index, val) => {
    setStudentList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], rollNo: val };
      return updated;
    });
  };

  // Auto-fill roll numbers starting from startRollNo
  const handleAutoFill = () => {
    let current = parseInt(startRollNo || 101, 10);
    setStudentList((prev) =>
      prev.map((s) => ({
        ...s,
        rollNo: String(current++),
      }))
    );
  };

  // Save Roll Numbers
  const handleSaveRollNos = async () => {
    if (studentList.length === 0) return;
    setSaving(true);
    setAlert(null);
    try {
      const updates = studentList.map((s) => ({
        formNo: s.formNo,
        newRollNo: s.rollNo,
      }));

      const res = await appsScriptApi.call('bulkUpdateRollNos', { updates });
      if (res && res.success !== false) {
        setAlert({ type: 'success', text: `Roll Numbers updated successfully for ${studentList.length} students.` });
        if (appsScriptApi.invalidateAdminCache) appsScriptApi.invalidateAdminCache();
        onRefresh(true);
      } else {
        setAlert({ type: 'error', text: res?.message || 'Failed to update roll numbers.' });
      }
    } catch (err) {
      console.error('Save roll numbers error:', err);
      setAlert({ type: 'error', text: err.userMessage || err.message || 'Failed to update roll numbers.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Notification */}
      {alert && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-fadeIn ${
          alert.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-600' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
        }`}>
          {alert.type === 'error' ? <AlertCircle size={16} className="flex-shrink-0" /> : <CheckCircle2 size={16} className="flex-shrink-0" />}
          <span>{alert.text}</span>
        </div>
      )}

      {/* Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="space-y-1">
          <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Class *</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-amber-500"
            style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
          >
            <option value="12th">12th Class</option>
            <option value="11th">11th Class</option>
            <option value="10th">10th Class</option>
            <option value="9th">9th Class</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Stream</label>
          <select
            value={selectedStream}
            onChange={(e) => setSelectedStream(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-amber-500"
            style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
          >
            <option value="All">All Streams</option>
            <option value="Science">Science</option>
            <option value="Humanities">Humanities</option>
            <option value="Commerce">Commerce</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Sort Order</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-amber-500"
            style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
          >
            <option value="formNo">By Form Number</option>
            <option value="name">Alphabetical (By Name)</option>
          </select>
        </div>

        {/* Auto Fill Control */}
        <div className="space-y-1">
          <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Start Roll No</label>
          <div className="flex gap-1.5">
            <input
              type="number"
              value={startRollNo}
              onChange={(e) => setStartRollNo(e.target.value)}
              className="w-24 px-3 py-2 rounded-xl font-mono font-bold border text-xs focus:ring-2 focus:ring-amber-500"
              style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
            />
            <button
              type="button"
              onClick={handleAutoFill}
              className="flex-1 px-3 py-2 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-500 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Wand2 size={13} /> Auto Fill
            </button>
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
        <table className="w-full text-left text-xs">
          <thead style={{ backgroundColor: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-muted, #64748b)' }}>
            <tr>
              <th className="p-3 font-extrabold">S.No.</th>
              <th className="p-3 font-extrabold">Form #</th>
              <th className="p-3 font-extrabold">Student Name</th>
              <th className="p-3 font-extrabold">Class</th>
              <th className="p-3 font-extrabold">Stream</th>
              <th className="p-3 font-extrabold text-right">Assigned Class Roll No</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-ui, #f1f5f9)' }}>
            {studentList.length > 0 ? (
              studentList.map((st, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-slate-500">{idx + 1}</td>
                  <td className="p-3 font-mono font-bold text-amber-600">{st.formNo}</td>
                  <td className="p-3 font-extrabold" style={{ color: 'var(--text-main, #0f172a)' }}>{st.name}</td>
                  <td className="p-3 text-slate-500">{st.class}</td>
                  <td className="p-3 text-slate-500">{st.stream}</td>
                  <td className="p-3 text-right">
                    <input
                      type="text"
                      value={st.rollNo}
                      onChange={(e) => handleRollNoChange(idx, e.target.value)}
                      placeholder="Roll No"
                      className="w-28 px-3 py-1.5 rounded-xl border text-right font-mono font-bold focus:ring-2 focus:ring-amber-500"
                      style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                  No students found for class {selectedClass}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
        <button
          type="button"
          onClick={handleSaveRollNos}
          disabled={saving || studentList.length === 0}
          className="px-6 py-3.5 rounded-2xl font-extrabold text-xs text-white bg-amber-600 hover:bg-amber-500 shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw size={16} className="animate-spin" /> Saving Roll Numbers...
            </>
          ) : (
            <>
              <Save size={16} /> Save Roll Numbers ({studentList.length} Students)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
