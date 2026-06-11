import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Save, Download, Plus, Trash2, FileText, Users, AlertCircle, CheckCircle2, UserPlus, RefreshCw } from 'lucide-react';
import { DEFAULT_SETTINGS, loadSiteSettings } from '../utils/settingsLoader';

export default function AdminPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Tab states: 'admissions' | 'notices' | 'faculty' | 'export'
  const [activeTab, setActiveTab] = useState('admissions');

  // Configuration States
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [notices, setNotices] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Password for admin access
  const ADMIN_PASSWORD = 'admin123';

  // Login handler
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('isAdminAuthenticated', 'true');
      setAuthError('');
    } else {
      setAuthError('Incorrect administrative password. Please try again.');
    }
  };

  // Check session on mount
  useEffect(() => {
    if (sessionStorage.getItem('isAdminAuthenticated') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch configs on login
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);

    // 1. Load admissions settings
    loadSiteSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
    });

    // 2. Load notices
    fetch('/slides/notices.txt', { cache: 'no-cache' })
      .then((r) => r.text())
      .then((text) => {
        const parsed = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const firstComma = line.indexOf(',');
            if (firstComma === -1) return null;
            const date = line.substring(0, firstComma).trim();
            const rest = line.substring(firstComma + 1);
            
            const secondComma = rest.indexOf(',');
            if (secondComma === -1) {
              return { date, title: rest.trim(), link: '#' };
            }
            const title = rest.substring(0, secondComma).trim();
            const link = rest.substring(secondComma + 1).trim();
            return { date, title, link };
          })
          .filter(Boolean);
        setNotices(parsed);
      })
      .catch(() => {
        // Use default fallback if missing
        setNotices([
          { date: 'Nov 23', title: 'JKBOSE Datesheet', link: 'https://jkbose.nic.in' },
          { date: 'Nov 23', title: 'PreBoard Results', link: '#' },
          { date: 'Nov 23', title: 'Admit Cards', link: '/admissions' }
        ]);
      });

    // 3. Load faculty directory
    fetch('/slides/faculty.json', { cache: 'no-cache' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFaculty(data);
      })
      .catch(() => {
        // Fetch default fallback faculty from file if fetch fails or is empty
        setFaculty([
          { name: "Mr. Aijaz Ahmad Wagay", designation: "Principal", subject: "Chemistry", email: "ghssshangus74@gmail.com", mobile: "+91-7006034501", photo: "/slides/Principal.jpg", department: "Administration" }
        ]);
      })
      .finally(() => setLoading(false));

  }, [isAuthenticated]);

  // Settings handlers
  const handleGlobalToggle = () => {
    setSettings((s) => ({ ...s, globalAdmissionsClosed: !s.globalAdmissionsClosed }));
  };

  const handleClassToggle = (cls) => {
    setSettings((s) => ({
      ...s,
      admissionsClosed: {
        ...s.admissionsClosed,
        [cls]: !s.admissionsClosed[cls]
      }
    }));
  };

  const handleFeeChange = (key, val) => {
    const num = parseInt(val) || 0;
    setSettings((s) => ({
      ...s,
      fees: {
        ...s.fees,
        [key]: num
      }
    }));
  };

  // Notice Handlers
  const [newNotice, setNewNotice] = useState({ date: '', title: '', link: '' });
  
  const handleAddNotice = () => {
    if (!newNotice.date || !newNotice.title) return;
    setNotices((prev) => [...prev, newNotice]);
    setNewNotice({ date: '', title: '', link: '' });
  };

  const handleDeleteNotice = (idx) => {
    setNotices((prev) => prev.filter((_, i) => i !== idx));
  };

  // Faculty Handlers
  const [newTeacher, setNewTeacher] = useState({ name: '', designation: 'Lecturer', subject: '', email: '', mobile: '', department: 'Humanities', photo: '' });

  const handleAddTeacher = () => {
    if (!newTeacher.name || !newTeacher.designation) return;
    
    // Auto-prepend /slides/ if user supplies just a file name
    let photoPath = newTeacher.photo.trim();
    if (photoPath && !photoPath.startsWith('/') && !photoPath.startsWith('http')) {
      photoPath = `/slides/${photoPath}`;
    }

    setFaculty((prev) => [...prev, { ...newTeacher, photo: photoPath, id: Date.now() }]);
    setNewTeacher({ name: '', designation: 'Lecturer', subject: '', email: '', mobile: '', department: 'Humanities', photo: '' });
  };

  const handleDeleteTeacher = (name) => {
    setFaculty((prev) => prev.filter((t) => t.name !== name));
  };

  // Central Save & Exporter
  const handleSaveToLocalStorage = () => {
    localStorage.setItem('site_settings', JSON.stringify(settings));
    
    // Save notices.txt representation to local storage
    const noticesText = notices.map(n => `${n.date},${n.title},${n.link || '#'}`).join('\n');
    localStorage.setItem('site_notices', noticesText);
    
    // Save faculty to local storage
    localStorage.setItem('site_faculty', JSON.stringify(faculty));

    setSaveSuccess('Configurations updated successfully in your current browser! Go to the "Export" tab to download files for global updates.');
    setTimeout(() => setSaveSuccess(''), 4000);
  };

  // Downloader utilities
  const downloadFile = (filename, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadSettingsJson = () => {
    const content = JSON.stringify(settings, null, 2);
    downloadFile('settings.json', content, 'application/json');
  };

  const downloadNoticesTxt = () => {
    const content = notices.map(n => `${n.date},${n.title},${n.link || '#'}`).join('\n');
    downloadFile('notices.txt', content, 'text/plain');
  };

  const downloadFacultyJson = () => {
    // Exclude 'id' helper property from JSON output to keep it clean
    const cleanedFaculty = faculty.map(({ id, ...rest }) => rest);
    const content = JSON.stringify(cleanedFaculty, null, 2);
    downloadFile('faculty.json', content, 'application/json');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700 p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4 text-orange-500">
              <Lock size={32} />
            </div>
            <h2 className="text-xl font-bold text-center font-title tracking-wide text-orange-400">Govt. HSS Shangus</h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Administrative Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Administrative Password</label>
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                autoFocus
              />
            </div>

            {authError && (
              <div className="bg-red-950/50 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Unlock size={16} />
              Unlock Console
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h2 className="text-2xl font-bold font-title tracking-wider text-orange-400">Admin Console</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">Govt. Higher Secondary School Shangus Control Center</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveToLocalStorage}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-colors"
            >
              <Save size={14} />
              Apply & Save
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem('isAdminAuthenticated');
                setIsAuthenticated(false);
              }}
              className="px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              Lock Console
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {saveSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-sm mb-6 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-3 duration-300">
            <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 mb-8 overflow-x-auto gap-2">
          {[
            { id: 'admissions', label: 'Admissions & Fees', icon: FileText },
            { id: 'notices', label: 'Latest Notices', icon: RefreshCw },
            { id: 'faculty', label: 'Faculty Directory', icon: Users },
            { id: 'export', label: 'Export files', icon: Download }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex-shrink-0 ${active ? 'border-orange-500 text-orange-400 bg-slate-900/50' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Console Body */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mb-4" />
            Loading configuration data...
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 shadow-xl">
            
            {/* TAB 1: ADMISSIONS AND FEES */}
            {activeTab === 'admissions' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* Global admissions open/close */}
                <div className="bg-slate-900/60 p-5 rounded-lg border border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-200">Global Enrollment System</h3>
                    <p className="text-xs text-slate-400 mt-1">Enable or disable registration online across all streams and classes.</p>
                  </div>
                  <button
                    onClick={handleGlobalToggle}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${settings.globalAdmissionsClosed ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                  >
                    {settings.globalAdmissionsClosed ? 'Admissions Closed' : 'Admissions Open'}
                  </button>
                </div>

                {/* Class admissions flags */}
                <div>
                  <h3 className="text-sm font-semibold uppercase text-slate-400 tracking-wider mb-4">Class-Wise Admission Flags</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['9th', '10th', '11th', '12th'].map((cls) => {
                      const isClosed = settings.globalAdmissionsClosed || settings.admissionsClosed[cls];
                      return (
                        <div key={cls} className="bg-slate-900/30 p-4 rounded-lg border border-slate-800 flex flex-col justify-between items-center text-center">
                          <span className="font-bold text-slate-300">{cls} Class</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full mt-1.5 ${isClosed ? 'bg-red-950 text-red-400 border border-red-900' : 'bg-emerald-950 text-emerald-400 border border-emerald-900'}`}>
                            {isClosed ? 'Closed' : 'Open'}
                          </span>
                          <button
                            disabled={settings.globalAdmissionsClosed}
                            onClick={() => handleClassToggle(cls)}
                            className="mt-4 w-full py-1 text-[11px] font-bold rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors"
                          >
                            Toggle Status
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Fee structure configuration */}
                <div>
                  <h3 className="text-sm font-semibold uppercase text-slate-400 tracking-wider mb-4">Fee Structure Configuration (INR)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Senior Secondary */}
                    <div className="bg-slate-900/30 p-5 rounded-lg border border-slate-800">
                      <h4 className="font-bold text-slate-300 border-b border-slate-800 pb-2 mb-4">11th & 12th Combinations</h4>
                      <div className="space-y-4">
                        {[
                          { key: '11th_science_boys', label: '11th Science (Boys)' },
                          { key: '11th_science_girls', label: '11th Science (Girls)' },
                          { key: '11th_humanities_boys', label: '11th Humanities (Boys)' },
                          { key: '11th_humanities_girls', label: '11th Humanities (Girls)' },
                          { key: '12th_science_boys', label: '12th Science (Boys)' },
                          { key: '12th_science_girls', label: '12th Science (Girls)' },
                          { key: '12th_humanities_boys', label: '12th Humanities (Boys)' },
                          { key: '12th_humanities_girls', label: '12th Humanities (Girls)' }
                        ].map((feeItem) => (
                          <div key={feeItem.key} className="flex justify-between items-center gap-4">
                            <span className="text-xs text-slate-400">{feeItem.label}</span>
                            <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 w-32">
                              <span className="text-xs text-slate-500 mr-1.5">Rs.</span>
                              <input
                                type="number"
                                value={settings.fees[feeItem.key] || 0}
                                onChange={(e) => handleFeeChange(feeItem.key, e.target.value)}
                                className="w-full bg-transparent border-none py-1 text-right text-xs font-mono text-white focus:outline-none focus:ring-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Secondary Subjects */}
                    <div className="bg-slate-900/30 p-5 rounded-lg border border-slate-800 h-fit">
                      <h4 className="font-bold text-slate-300 border-b border-slate-800 pb-2 mb-4">Secondary Classes</h4>
                      <div className="space-y-4">
                        {[
                          { key: '9th', label: '9th Class Subjects' },
                          { key: '10th', label: '10th Class Subjects' }
                        ].map((feeItem) => (
                          <div key={feeItem.key} className="flex justify-between items-center gap-4">
                            <span className="text-xs text-slate-400">{feeItem.label}</span>
                            <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 w-32">
                              <span className="text-xs text-slate-500 mr-1.5">Rs.</span>
                              <input
                                type="number"
                                value={settings.fees[feeItem.key] || 0}
                                onChange={(e) => handleFeeChange(feeItem.key, e.target.value)}
                                className="w-full bg-transparent border-none py-1 text-right text-xs font-mono text-white focus:outline-none focus:ring-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LATEST NOTICES */}
            {activeTab === 'notices' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold text-slate-200">Latest Notices Configuration</h3>
                    <p className="text-xs text-slate-400">Add, edit, or delete items on the school's dynamic announcement board.</p>
                  </div>
                </div>

                {/* Add new notice form */}
                <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-800 flex flex-col md:flex-row gap-4 items-end">
                  <div className="w-full md:w-32">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                    <input
                      type="text"
                      placeholder="e.g. Nov 23"
                      value={newNotice.date}
                      onChange={(e) => setNewNotice({ ...newNotice, date: e.target.value })}
                      className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="Notice Title Description"
                      value={newNotice.title}
                      onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                      className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Link (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. /admissions, https://jkbose.nic.in, or #"
                      value={newNotice.link}
                      onChange={(e) => setNewNotice({ ...newNotice, link: e.target.value })}
                      className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <button
                    onClick={handleAddNotice}
                    className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1 flex-shrink-0 transition-colors h-[34px]"
                  >
                    <Plus size={14} />
                    Add Notice
                  </button>
                </div>

                {/* Notices List Table */}
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                        <th className="p-3 w-28">Date</th>
                        <th className="p-3">Notice Title</th>
                        <th className="p-3 w-48">Link</th>
                        <th className="p-3 w-20 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {notices.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500 italic">No notices configured. Add some above.</td>
                        </tr>
                      ) : (
                        notices.map((n, i) => (
                          <tr key={i} className="hover:bg-slate-900/30">
                            <td className="p-3 font-semibold text-slate-400">{n.date}</td>
                            <td className="p-3 text-slate-200">{n.title}</td>
                            <td className="p-3 text-slate-500 truncate max-w-xs font-mono">{n.link || '#'}</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteNotice(i)}
                                className="p-1 rounded text-red-400 hover:bg-red-950 hover:text-red-300 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: FACULTY DIRECTORY */}
            {activeTab === 'faculty' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-slate-200">Faculty & Staff Directory Editor</h3>
                  <p className="text-xs text-slate-400">Configure cards, department settings, and contacts inside the dynamic directory.</p>
                </div>

                {/* Add new faculty form */}
                <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-800 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Mr. Sheikh Gulfam"
                        value={newTeacher.name}
                        onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Designation</label>
                      <input
                        type="text"
                        placeholder="e.g. Lecturer, Teacher, Vice Principal"
                        value={newTeacher.designation}
                        onChange={(e) => setNewTeacher({ ...newTeacher, designation: e.target.value })}
                        className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Subject</label>
                      <input
                        type="text"
                        placeholder="e.g. Physics, Chemistry, Botany"
                        value={newTeacher.subject}
                        onChange={(e) => setNewTeacher({ ...newTeacher, subject: e.target.value })}
                        className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Department</label>
                      <select
                        value={newTeacher.department}
                        onChange={(e) => setNewTeacher({ ...newTeacher, department: e.target.value })}
                        className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      >
                        <option value="Administration">Administration</option>
                        <option value="Science">Science</option>
                        <option value="Humanities">Humanities</option>
                        <option value="Secondary">Secondary (9th-10th)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="e.g. example@gmail.com"
                        value={newTeacher.email}
                        onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                        className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mobile No</label>
                      <input
                        type="text"
                        placeholder="e.g. +91-7006XXXXXX"
                        value={newTeacher.mobile}
                        onChange={(e) => setNewTeacher({ ...newTeacher, mobile: e.target.value })}
                        className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Photo Filename (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Gulfam.jpg"
                        value={newTeacher.photo}
                        onChange={(e) => setNewTeacher({ ...newTeacher, photo: e.target.value })}
                        className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="text-right">
                    <button
                      onClick={handleAddTeacher}
                      className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 inline-flex transition-colors"
                    >
                      <UserPlus size={14} />
                      Add Faculty Member
                    </button>
                  </div>
                </div>

                {/* Faculty list */}
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                        <th className="p-3">Name</th>
                        <th className="p-3">Role / Subject</th>
                        <th className="p-3">Department</th>
                        <th className="p-3">Contact</th>
                        <th className="p-3">Photo URL</th>
                        <th className="p-3 w-20 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {faculty.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500 italic">No faculty members configured. Add some above.</td>
                        </tr>
                      ) : (
                        faculty.map((t, index) => (
                          <tr key={t.name + index} className="hover:bg-slate-900/30">
                            <td className="p-3 font-semibold text-slate-200">{t.name}</td>
                            <td className="p-3 text-slate-300">{t.designation} {t.subject ? `in ${t.subject}` : ''}</td>
                            <td className="p-3">
                              <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 text-[10px] font-semibold">{t.department}</span>
                            </td>
                            <td className="p-3 text-slate-400">
                              <div className="space-y-0.5">
                                <div>{t.email || '-'}</div>
                                <div className="text-[10px] font-mono text-slate-500">{t.mobile || '-'}</div>
                              </div>
                            </td>
                            <td className="p-3 font-mono text-slate-500 text-[10px] max-w-[120px] truncate">{t.photo || 'None'}</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteTeacher(t.name)}
                                className="p-1 rounded text-red-400 hover:bg-red-950 hover:text-red-300 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: EXPORT FILES */}
            {activeTab === 'export' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-slate-200">Export & Update Public Slides Folder</h3>
                  <p className="text-xs text-slate-400 mt-1">Generate and download updated configuration files to copy into your repository/server.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* settings.json card */}
                  <div className="bg-slate-900/40 p-5 rounded-lg border border-slate-800 flex flex-col justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={18} className="text-orange-400" />
                        <h4 className="font-bold text-slate-200 text-sm">settings.json</h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Contains class-wise admission open/closed flags and the updated fee schedules. Place inside:
                      </p>
                      <code className="block text-[10.5px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800 text-slate-300 mt-2 text-center select-all">
                        public/slides/settings.json
                      </code>
                    </div>
                    <button
                      onClick={downloadSettingsJson}
                      className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} />
                      Download settings.json
                    </button>
                  </div>

                  {/* notices.txt card */}
                  <div className="bg-slate-900/40 p-5 rounded-lg border border-slate-800 flex flex-col justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw size={18} className="text-emerald-400" />
                        <h4 className="font-bold text-slate-200 text-sm">notices.txt</h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Contains the comma-separated date, notice title, and link array. Place inside:
                      </p>
                      <code className="block text-[10.5px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800 text-slate-300 mt-2 text-center select-all">
                        public/slides/notices.txt
                      </code>
                    </div>
                    <button
                      onClick={downloadNoticesTxt}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} />
                      Download notices.txt
                    </button>
                  </div>

                  {/* faculty.json card */}
                  <div className="bg-slate-900/40 p-5 rounded-lg border border-slate-800 flex flex-col justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={18} className="text-sky-400" />
                        <h4 className="font-bold text-slate-200 text-sm">faculty.json</h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Contains the complete JSON database of faculty members. Place inside:
                      </p>
                      <code className="block text-[10.5px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800 text-slate-300 mt-2 text-center select-all">
                        public/slides/faculty.json
                      </code>
                    </div>
                    <button
                      onClick={downloadFacultyJson}
                      className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} />
                      Download faculty.json
                    </button>
                  </div>

                </div>

                {/* Instructions banner */}
                <div className="bg-slate-900/20 border border-slate-800/80 p-5 rounded-lg text-xs leading-relaxed text-slate-400">
                  <h4 className="font-bold text-slate-300 mb-2 uppercase text-[10px] tracking-wider">How to Apply Changes Globally:</h4>
                  <ol className="list-decimal pl-4 space-y-2">
                    <li>Make modifications in the Admissions, Notices, and Faculty tabs.</li>
                    <li>Click <strong className="text-emerald-400">"Apply & Save"</strong> in the top header. This updates the local storage in your current browser immediately so you can verify the layout.</li>
                    <li>Click the respective download buttons above to download the updated configuration files.</li>
                    <li>Copy and replace these files inside your project's <code className="bg-slate-950 p-0.5 rounded px-1 font-mono text-slate-300">public/slides/</code> directory.</li>
                    <li>Commit/push the files to your repository or rebuild the Netlify site. Once deployed, the updates will be visible to all users globally!</li>
                  </ol>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
