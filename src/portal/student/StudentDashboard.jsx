import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { FileText, Download, Edit3, RefreshCw, LogOut, ShieldCheck, CheckCircle2, Clock, AlertCircle, Sparkles, ArrowRight, X, Eye, Trash2, Printer } from 'lucide-react';
import SEO from '../../components/SEO';
import ModernLoader from '../../components/ModernLoader';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { generateStudentAdmissionPdf, downloadStudentAdmissionPdf } from '../../utils/pdfGenerator';
import { getCachedCollection, getCachedCollectionSync } from '../../services/dbCache';
import appsScriptApi from '../../services/appsScriptApi';

export default function StudentDashboard() {
  const { user, onLogout, refreshSession } = useOutletContext();
  const navigate = useNavigate();

  // Dashboard Data State
  const [loading, setLoading] = useState(true);
  const [appData, setAppData] = useState(null);
  const [sessionInfo, setSessionInfo] = useState('');
  const [alert, setAlert] = useState(null);

  // Edit Profile Modal State
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileMobile, setProfileMobile] = useState(user?.mobile || '');
  const [profileResidence, setProfileResidence] = useState(user?.residence || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // PDF Generation State
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const handleLogoutRequest = () => setShowLogoutConfirm(true);

  // Fetch student application & initial data (Fast SWR Firestore Workflow)
  const loadDashboardData = useCallback(async () => {
    setAlert(null);
    if (!user) {
      setLoading(false);
      return;
    }

    const userEmail = (user?.email || '').toLowerCase().trim();
    const userMobile = String(user?.mobile || '').trim();
    const userName = (user?.name || '').toLowerCase().trim();

    const findMatch = (allApps) => {
      if (!allApps || allApps.length === 0) return null;
      return [...allApps].reverse().find(a => {
        const appEmail = String(a['Email Address'] || a['Email'] || a.email || a.Email || a.userEmail || '').toLowerCase().trim();
        const appMobile = String(a['Mobile No. (with working WhatsApp)'] || a['Mobile No.'] || a.mobile || a.StudentMobile || '').replace(/[^0-9]/g, '');
        const cleanUserMobile = userMobile.replace(/[^0-9]/g, '');

        const matchesEmail = Boolean(userEmail && appEmail && (appEmail === userEmail));
        const matchesMobile = Boolean(cleanUserMobile && cleanUserMobile.length >= 10 && appMobile && appMobile.length >= 10 && (appMobile.slice(-10) === cleanUserMobile.slice(-10)));

        // STRICT SECURITY RULE: Match ONLY by authenticated Email or Mobile Number.
        // NEVER match by name alone, as multiple students can share the same name!
        return matchesEmail || matchesMobile;
      });
    };

    // 1. Instant Sync Cache Check
    const cachedApps = getCachedCollectionSync('admissions');
    if (cachedApps) {
      const match = findMatch(cachedApps);
      if (match) {
        setAppData(match);
        setLoading(false);
      }
    }

    // 2. Background Revalidation / Cold Load
    try {
      let activeSession = '2025-26';
      try {
        const settingsSnap = await getDoc(doc(db, 'site', 'settings'));
        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data();
          activeSession = settingsData.session || settingsData.currentSession || activeSession;
        }
      } catch (e) {}
      setSessionInfo(activeSession);

      const allApps = await getCachedCollection('admissions', false, 30 * 60 * 1000, (freshApps) => {
        // Silent background update callback
        const freshMatch = findMatch(freshApps);
        if (freshMatch) setAppData(freshMatch);
      });

      const matchedApp = findMatch(allApps);
      setAppData(matchedApp || null);
    } catch (fsErr) {
      console.error('Firestore student dashboard read error:', fsErr);
      setAlert({ type: 'error', text: 'Error fetching application data from database.' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle Edit Profile Save (Direct Firestore Write)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName || !profileMobile) {
      setAlert({ type: 'error', text: 'Name and Mobile number are required.' });
      return;
    }
    setSavingProfile(true);
    try {
      const userEmailClean = (user?.email || '').toLowerCase().trim();

      if (userEmailClean) {
        const userDocRef = doc(db, 'users', userEmailClean);
        await setDoc(userDocRef, {
          Name: profileName.trim(),
          name: profileName.trim(),
          Mobile: profileMobile.trim(),
          mobile: profileMobile.trim(),
          Residence: profileResidence.trim(),
          residence: profileResidence.trim(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      setShowEditProfile(false);
      refreshSession();
      setAlert({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      console.error('Profile update error:', err);
      setAlert({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle View PDF Print Preview
  const handleViewPdf = () => {
    if (!appData) return;
    generateStudentAdmissionPdf(appData);
  };

  // Handle Download PDF Copy
  const handleDownloadPdf = async () => {
    if (!appData) return;
    setDownloadingPdf(true);
    try {
      await downloadStudentAdmissionPdf(appData);
    } catch (err) {
      console.error('Download PDF error:', err);
      setAlert({ type: 'error', text: 'Unable to download PDF. Please try again.' });
    } finally {
      setTimeout(() => setDownloadingPdf(false), 500);
    }
  };

  // Delete Application Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteChecked, setConfirmDeleteChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Handle Delete Application Request (Opens Modal)
  const handleDeleteMyApplication = () => {
    if (!appData) return;
    setConfirmDeleteChecked(false);
    setShowDeleteModal(true);
  };

  // Execute Final Permanent Application Deletion
  const executeDeleteApplication = async () => {
    if (!appData) return;
    const formNo = appData['Form Number'] || appData['FormNo'] || appData['Form No.'] || appData.docId || appData.id;
    setDeleting(true);
    try {
      const res = await appsScriptApi.deleteStudentApplication(formNo);
      if (res && res.success !== false) {
        setShowDeleteModal(false);
        setAppData(null);
        try { sessionStorage.removeItem('hss_admission_draft'); } catch(e) {}
        setAlert({ type: 'success', text: `✨ Application #${formNo} deleted successfully! Form number #${formNo} has been recycled into the system queue. You can now fill out your admission form afresh.` });
      } else {
        setAlert({ type: 'error', text: res?.error || res?.message || 'Failed to delete application.' });
      }
    } catch (err) {
      setAlert({ type: 'error', text: 'Error deleting application.' });
    } finally {
      setDeleting(false);
    }
  };

  const status = appData?.Status || 'No Application';
  const formNum = appData?.['Form Number'] || 'N/A';
  const classSought = appData?.['Admission sought for class'] || 'N/A';
  const rollNo = appData?.['Class Roll No'] || appData?.RollNo || '';

  return (
    <div className="w-full min-h-[85vh] py-4 px-3 sm:px-4" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="Student Dashboard"
        description="Govt HSS Shangus Online Student Admission Portal Dashboard."
        path="/portal/student"
      />

      <div className="max-w-5xl mx-auto space-y-4">
        {/* Top Welcome Hero Card */}
        <div className="rounded-2xl p-4 sm:p-5 border shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center font-extrabold text-xl text-teal-600 flex-shrink-0">
              {(user?.name || 'S').charAt(0).toUpperCase()}
            </div>

            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600">
                <ShieldCheck size={12} /> Student Account
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold" style={{ color: 'var(--text-main, #0f172a)' }}>
                Welcome, {user?.name || 'Student'}
              </h1>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted, #64748b)' }}>
                {user?.email} • {user?.mobile || 'No Phone registered'}
              </p>
            </div>
          </div>

          {/* Quick Action Header Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                setProfileName(user?.name || '');
                setProfileMobile(user?.mobile || '');
                setProfileResidence(user?.residence || '');
                setShowEditProfile(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #334155)' }}
            >
              <Edit3 size={14} /> Edit Profile
            </button>

            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="p-2 rounded-xl border cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #334155)' }}
              title="Refresh Data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleLogoutRequest}
              className="px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-all duration-200 shadow-2xs"
              style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #cbd5e1' }}
              title="Sign out"
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#dc2626';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.color = '#000000';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {alert && (
          <div className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-fadeIn ${
            alert.type === 'error'
              ? 'bg-red-500/10 border border-red-500/30 text-red-600'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
          }`}>
            {alert.type === 'error' ? <AlertCircle size={16} className="flex-shrink-0" /> : <CheckCircle2 size={16} className="flex-shrink-0" />}
            <span>{alert.text}</span>
          </div>
        )}

        {/* Loading Spinner State */}
        {loading ? (
          <ModernLoader
            text="Loading Student Dashboard"
            subtext="Fetching application status, PDF credentials & school session records..."
          />
        ) : (
          /* Application Status Box */
          <div className="rounded-3xl p-6 sm:p-8 border shadow-xl space-y-6" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
              <div>
                <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-main, #0f172a)' }}>
                  Admission Application Status
                </h2>
                <div className="text-xs text-slate-400 mt-0.5">Session: {sessionInfo}</div>
              </div>

              {/* Status Badge */}
              <div className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${
                status === 'Submitted'
                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                  : status === 'Approved'
                  ? 'bg-teal-500/15 text-teal-600 border border-teal-500/30'
                  : status === 'Rejected'
                  ? 'bg-red-500/15 text-red-600 border border-red-500/30'
                  : status === 'Draft'
                  ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                  : 'bg-slate-500/15 text-slate-600 border border-slate-500/30'
              }`}>
                {status === 'Submitted' && <CheckCircle2 size={13} />}
                {status === 'Draft' && <Clock size={13} />}
                {status === 'Rejected' && <AlertCircle size={13} />}
                <span>{status}</span>
              </div>
            </div>

            {/* Application Overview Cards */}
            {appData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
                    <div className="text-slate-400 text-[10px] uppercase font-bold">Form Number</div>
                    <div className="font-extrabold text-sm mt-0.5" style={{ color: 'var(--text-main, #0f172a)' }}>{formNum}</div>
                  </div>

                  <div className="p-3.5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
                    <div className="text-slate-400 text-[10px] uppercase font-bold">Class Sought</div>
                    <div className="font-extrabold text-sm mt-0.5" style={{ color: 'var(--text-main, #0f172a)' }}>{classSought}</div>
                  </div>

                  <div className="p-3.5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
                    <div className="text-slate-400 text-[10px] uppercase font-bold">Stream</div>
                    <div className="font-extrabold text-sm mt-0.5" style={{ color: 'var(--text-main, #0f172a)' }}>
                      {appData['Stream for Class 11th'] || appData['Stream'] || 'N/A'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
                    <div className="text-slate-400 text-[10px] uppercase font-bold">Class Roll No</div>
                    <div className="font-extrabold text-sm mt-0.5 text-teal-600">
                      {rollNo || 'Pending Assignment'}
                    </div>
                  </div>
                </div>

                {/* Status Guidance Banner */}
                <div className={`p-4 rounded-2xl text-xs font-medium leading-relaxed ${
                  status === 'Draft'
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300'
                    : status === 'Submitted'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : status === 'Rejected'
                    ? 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}>
                  {status === 'Draft' && (
                    <span>You have a saved draft application. Click <strong>"Continue Application"</strong> below to complete your admission form and submit.</span>
                  )}
                  {status === 'Submitted' && (
                    <span>Your application has been received successfully and is under official verification. You can download a PDF copy of your submitted form below.</span>
                  )}
                  {status === 'Rejected' && (
                    <span>Your application requires corrections. Reason: <strong className="text-red-600 dark:text-red-400">{appData.rejectionReason || appData['Rejection Reason'] || appData['Rejected Reason'] || 'Please contact admission office.'}</strong></span>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={() => navigate('/portal/student/application')}
                    className="px-6 py-3.5 rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer bg-teal-600 hover:bg-teal-500 text-white"
                  >
                    {status === 'Draft' ? (
                      <>
                        <Edit3 size={16} />
                        <span>Continue Draft Application</span>
                      </>
                    ) : status === 'Rejected' || appData.isEditable || appData['Lock Status'] === 'Unlocked' ? (
                      <>
                        <Edit3 size={16} />
                        <span>Edit Application Details</span>
                      </>
                    ) : (
                      <>
                        <FileText size={16} />
                        <span>Apply Online / View Form</span>
                      </>
                    )}
                    <ArrowRight size={16} />
                  </button>

                  {status !== 'Draft' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleViewPdf}
                        className="px-4 py-3.5 rounded-2xl font-extrabold text-xs border flex items-center gap-2 cursor-pointer transition-all bg-teal-700 text-white hover:bg-teal-600 shadow-sm"
                        title="Print or Save as PDF via browser dialog"
                      >
                        <Printer size={16} />
                        <span>Print PDF</span>
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleDeleteMyApplication}
                    className="px-4 py-3.5 rounded-2xl font-bold text-xs border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 cursor-pointer transition-all ml-auto"
                    title="Delete current form record and apply fresh"
                  >
                    <Trash2 size={15} />
                    <span>Delete & Apply Afresh</span>
                  </button>
                </div>
              </div>
            ) : (
              /* No Application Found — Offer New Application */
              <div className="p-8 text-center rounded-2xl border space-y-4" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
                <div className="w-14 h-14 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600 mx-auto">
                  <FileText size={28} />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-extrabold" style={{ color: 'var(--text-main, #0f172a)' }}>
                    No Online Application Found for {sessionInfo}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    You haven't submitted an online admission form for the current academic session yet.
                  </p>
                </div>

                <button
                  onClick={() => navigate('/portal/student/application')}
                  className="px-6 py-3.5 rounded-2xl font-extrabold text-xs text-white bg-teal-500 hover:bg-teal-400 shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles size={16} />
                  <span>Start Online Admission Application</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-4 animate-fadeIn" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
              <h3 className="font-extrabold text-base flex items-center gap-2" style={{ color: 'var(--text-main, #0f172a)' }}>
                <Edit3 size={18} className="text-teal-500" /> Edit Student Profile
              </h3>
              <button onClick={() => setShowEditProfile(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Mobile Number *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={profileMobile}
                  onChange={(e) => setProfileMobile(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Residence Address</label>
                <input
                  type="text"
                  value={profileResidence}
                  onChange={(e) => setProfileResidence(e.target.value)}
                  placeholder="Village / Town, District"
                  className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfile(false)}
                  className="px-4 py-2.5 rounded-xl font-bold border cursor-pointer"
                  style={{ borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #334155)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 rounded-xl font-extrabold text-white bg-teal-500 hover:bg-teal-400 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={onLogout}
      />

      {/* Delete Application Warning Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl p-6 sm:p-7 border border-red-500/30 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl space-y-5 animate-scaleUp">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0">
                  <AlertCircle size={26} />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-red-600 dark:text-red-400">
                    Delete Application & Reset Record?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Warning: This action is permanent and cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form & Application Info Badge */}
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 font-bold">Target Form Number:</span>
                <span className="font-black text-teal-600 dark:text-teal-400 ml-1.5">
                  #{appData?.['Form Number'] || appData?.['FormNo'] || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold">Status:</span>
                <span className="font-extrabold text-amber-600 dark:text-amber-400 ml-1.5">
                  {status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Consequences List */}
            <div className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 bg-red-500/5 dark:bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
              <div className="font-extrabold text-red-600 dark:text-red-400 border-b pb-1.5 border-red-500/20 flex items-center gap-1.5">
                <span>⚠️ Consequences of Deletion:</span>
              </div>
              <ul className="space-y-2 pt-1">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Permanent Record Removal:</strong> Your active admission application form record will be completely erased from the school's official database register.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Recycling of Form Number:</strong> Form number <strong>#{appData?.['Form Number'] || appData?.['FormNo']}</strong> will be logged as recycled in the database for future assignment.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Loss of Submitted Details:</strong> All personal info, subject choices, contact records, and uploaded photo will be deleted.</span>
                </li>
              </ul>
            </div>

            {/* Mandatory Checkbox Confirmation */}
            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmDeleteChecked}
                onChange={(e) => setConfirmDeleteChecked(e.target.checked)}
                className="w-4.5 h-4.5 mt-0.5 rounded text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 leading-snug">
                I understand the consequences and confirm that I want to permanently delete my current application and start a fresh form.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                ← Cancel & Keep My Application
              </button>

              <button
                type="button"
                disabled={!confirmDeleteChecked || deleting}
                onClick={executeDeleteApplication}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Deleting Application...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Yes, Permanently Delete & Apply Afresh</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
