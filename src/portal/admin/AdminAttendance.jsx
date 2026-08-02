import React, { useState, useEffect } from 'react';
import { Settings, CalendarCheck, RefreshCw, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import ModernLoader from '../../components/ModernLoader';

export default function AdminAttendance() {
  const [activeSubTab, setActiveSubTab] = useState('settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Settings State
  const [attendanceConfig, setAttendanceConfig] = useState({
    '11th': { enabled: true, mode: 'daily' },
    '12th': { enabled: true, mode: 'daily' }
  });

  const [attendanceRecords, setAttendanceRecords] = useState([]);

  // Load configuration and data
  const loadData = async () => {
    setLoading(true);
    setAlert(null);

    // 1. Load Config
    try {
      const configDoc = await getDoc(doc(db, 'systemSettings', 'attendanceConfig'));
      if (configDoc.exists()) {
        setAttendanceConfig(configDoc.data());
      }
    } catch (e) {
      console.warn('[AdminAttendance] Attendance config fetch note:', e);
    }

    // 2. Load Submissions
    try {
      const querySnapshot = await getDocs(collection(db, 'attendance'));
      const records = [];
      querySnapshot.forEach(d => {
        records.push(d.data());
      });
      setAttendanceRecords(records);
    } catch (e) {
      console.warn('[AdminAttendance] Attendance data fetch note:', e);
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
      await setDoc(doc(db, 'systemSettings', 'attendanceConfig'), attendanceConfig, { merge: true });
      setAlert({ type: 'success', text: 'Attendance configuration saved successfully.' });
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', text: 'Failed to save configuration.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ModernLoader text="Loading Attendance Data" subtext="Fetching configurations and records..." />;
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header and Subtabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-3xl p-3 shadow-sm flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-black transition-colors whitespace-nowrap ${
              activeSubTab === 'settings' 
                ? 'bg-amber-700 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
          
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-black transition-colors whitespace-nowrap ${
              activeSubTab === 'overview' 
                ? 'bg-amber-700 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CalendarCheck size={14} />
            <span>Attendance Overview</span>
          </button>
        </div>
        
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs font-black hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
        >
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {alert && (
        <div className={`p-3 rounded-2xl text-xs font-bold border flex items-center gap-2 ${
          alert.type === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800/50' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50'
        }`}>
          {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {alert.text}
        </div>
      )}

      {/* VIEW: Settings */}
      {activeSubTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-3xl p-4 shadow-sm max-w-3xl mx-auto space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-black text-sm text-slate-900 dark:text-white">Attendance Control Panel</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mt-1">Enable or disable faculty attendance marking.</p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {['11th', '12th'].map((cls) => (
              <div key={cls} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800 dark:text-slate-200">{cls} Class Controls</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Portal Access:</span>
                    <div className={`w-9 h-5 rounded-full relative transition-colors ${attendanceConfig[cls]?.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${attendanceConfig[cls]?.enabled ? 'left-4.5' : 'left-0.5'}`} />
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={attendanceConfig[cls]?.enabled || false}
                      onChange={(e) => setAttendanceConfig({
                        ...attendanceConfig,
                        [cls]: { ...attendanceConfig[cls], enabled: e.target.checked }
                      })}
                    />
                  </label>
                </div>
              </div>
            ))}

            <button 
              type="submit" 
              disabled={saving}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              Save Configuration
            </button>
          </form>
        </div>
      )}

      {/* VIEW: Attendance Overview */}
      {activeSubTab === 'overview' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-3xl p-4 shadow-sm space-y-4">
           <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-wrap gap-2 items-center justify-between">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white">Attendance Log</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mt-1">Track daily faculty attendance submissions.</p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300">
              Total Records: {attendanceRecords.length}
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2.5 font-black uppercase text-[10px]">S.No.</th>
                  <th className="px-3 py-2.5 font-black uppercase text-[10px]">Date Submitted</th>
                  <th className="px-3 py-2.5 font-black uppercase text-[10px]">Attendance Date</th>
                  <th className="px-3 py-2.5 font-black uppercase text-[10px]">Class</th>
                  <th className="px-3 py-2.5 font-black uppercase text-[10px]">Subject</th>
                  <th className="px-3 py-2.5 font-black uppercase text-[10px]">Students</th>
                  <th className="px-3 py-2.5 font-black uppercase text-[10px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attendanceRecords.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map((rec, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 font-mono font-bold text-amber-600 dark:text-amber-400">{idx + 1}</td>
                    <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">
                      {new Date(rec.updatedAt).toLocaleDateString()} {new Date(rec.updatedAt).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 font-black text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20">{rec.date}</td>
                    <td className="px-3 py-2 font-black text-slate-900 dark:text-white">{rec.className}</td>
                    <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">{rec.subject}</td>
                    <td className="px-3 py-2 font-black text-slate-700 dark:text-slate-300">{rec.records?.length || 0}</td>
                    <td className="px-3 py-2">
                      <button className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {attendanceRecords.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-3 py-6 text-center text-slate-500 font-bold">No attendance records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
