import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { FileText, Edit3, RefreshCw, LogOut, ShieldCheck, CheckCircle2, Clock, AlertCircle, Sparkles, ArrowRight, X, Trash2, Printer, CreditCard, Mail, Plus, UserCog } from 'lucide-react';
import SEO from '../../components/SEO';
import ModernLoader from '../../components/ModernLoader';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { auth, db } from '../../services/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { selectStudentApplication } from '../../utils/studentApplicationSelection';
import { generateStudentAdmissionPdf, generateProvisionalAdmissionPdf } from '../../utils/pdfGenerator';
import { loadAdmissionWorkspace, withdrawAdmission } from '../../services/admissionWorkflowApi';
import { getStudentPhotoUrl, formatPhotoDisplayUrl } from '../../utils/imageCompressor';
import { fetchStudentPhotoOnDemand } from '../../services/dbCache';
import { checkEmailRateLimit, recordEmailSent, getRemainingCooldown } from '../../utils/emailRateLimiter';

function getCurrentAcademicSession() {
  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth() + 1; // 1-12 (Aug = 8, Oct = 10, Nov = 11)
  const calDay = now.getDate(); // 1-31
  // Till Oct 31st of the current calendar year: Academic Session is strictly 2025-26
  // From Nov 1st onwards: Session rolls over to 2026-27
  const isPastCutoff = calMonth > 10 || (calMonth === 10 && calDay > 31);
  const sessionEndYear = isPastCutoff ? calYear + 1 : calYear;
  const sessionStartYear = sessionEndYear - 1;
  return `${sessionStartYear}-${String(sessionEndYear).slice(-2)}`;
}

export default function StudentDashboard() {
  const { user, onLogout, refreshSession } = useOutletContext();
  const navigate = useNavigate();

  // Dashboard Data State
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [appData, setAppData] = useState(null);
  const [allApplications, setAllApplications] = useState([]);
  const [sessionInfo, setSessionInfo] = useState(() => getCurrentAcademicSession());
  const [alert, setAlert] = useState(null);

  // Email Verification State (On-demand with Cooldown)
  const [isEmailVerified, setIsEmailVerified] = useState(() => Boolean(auth.currentUser?.emailVerified));
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationCooldown, setVerificationCooldown] = useState(() => {
    const email = auth.currentUser?.email || user?.email || '';
    return getRemainingCooldown('email_verification', email, 60);
  });

  // Edit Profile Modal State
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileMobile, setProfileMobile] = useState(user?.mobile || '');
  const [profileResidence, setProfileResidence] = useState(user?.residence || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const handleLogoutRequest = () => setShowLogoutConfirm(true);

  // Cooldown countdown interval
  useEffect(() => {
    if (verificationCooldown <= 0) return;
    const timer = setInterval(() => {
      setVerificationCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [verificationCooldown]);

  // Check auth user status on load
  useEffect(() => {
    if (auth.currentUser) {
      auth.currentUser.reload().then(() => {
        setIsEmailVerified(Boolean(auth.currentUser?.emailVerified));
      }).catch(() => {});
    }
  }, []);

  const handleSendVerificationEmail = async () => {
    const currUser = auth.currentUser;
    if (!currUser) {
      setAlert({ type: 'error', text: 'You must be logged in to verify email.' });
      return;
    }
    const cleanEmail = String(currUser.email || user?.email || '').trim().toLowerCase();

    // Check rate limit (60s cooldown + 4 daily max)
    const check = checkEmailRateLimit('email_verification', cleanEmail, { cooldownSeconds: 60, maxDaily: 4 });
    if (!check.allowed) {
      setAlert({ type: 'error', text: check.message });
      if (check.remainingCooldown > 0) setVerificationCooldown(check.remainingCooldown);
      return;
    }

    setSendingVerification(true);
    setAlert(null);
    try {
      await sendEmailVerification(currUser, {
        url: `${window.location.origin}/portal/login`,
        handleCodeInApp: false,
      });
      recordEmailSent('email_verification', cleanEmail);
      setVerificationCooldown(60);
      setAlert({ type: 'success', text: `Verification link sent to ${cleanEmail}! Please check your inbox and spam folder.` });
    } catch (err) {
      console.error('Email verification error:', err);
      if (err.code === 'auth/too-many-requests' || err.code === 'auth/quota-exceeded') {
        setAlert({ type: 'error', text: 'Too many verification attempts. Please wait 15 minutes before requesting again.' });
      } else {
        setAlert({ type: 'error', text: err.message || 'Failed to send verification email.' });
      }
    } finally {
      setSendingVerification(false);
    }
  };

  const handleRefreshVerificationStatus = async () => {
    try {
      await auth.currentUser?.reload();
      const verified = Boolean(auth.currentUser?.emailVerified);
      setIsEmailVerified(verified);
      if (verified) {
        setAlert({ type: 'success', text: '🎉 Email verified successfully!' });
      } else {
        setAlert({ type: 'error', text: 'Email is not yet verified. Please click the link sent to your inbox first.' });
      }
    } catch (err) {
      console.warn('Reload user note:', err);
    }
  };

  // Fetch student application & initial data (Fast SWR Firestore Workflow)
  const loadDashboardData = useCallback(async () => {
    setAlert(null);
    setLoading(true);
    setLoadError(null);
    if (!user) {
      setLoading(false);
      return;
    }

    // Owner-scoped server load; never scan or cache every student's record.
    try {
      let activeSession = getCurrentAcademicSession();
      try {
        const applicationResult = await loadAdmissionWorkspace();
        const applications = applicationResult?.data?.applications || applicationResult?.applications || [];
        activeSession = applicationResult?.data?.activeSession || applicationResult?.activeSession || activeSession;
        setAllApplications(applications);
        let currentApp = selectStudentApplication(applications, activeSession);
        if (currentApp && (currentApp.Session || currentApp.session || currentApp['Academic Session'])) {
          activeSession = currentApp.Session || currentApp.session || currentApp['Academic Session'];
        } else {
          activeSession = applicationResult?.data?.activeSession || applicationResult?.activeSession || activeSession;
        }
        setSessionInfo(activeSession);

        if (currentApp) {
          try {
            const photo = await fetchStudentPhotoOnDemand(currentApp);
            if (photo && photo.length > 20 && photo !== '/logo.png') {
              currentApp = {
                ...currentApp,
                photo_id: photo,
                photoUrl: photo,
                'Student Photo': photo,
              };
            }
          } catch (pErr) {
            console.warn('Student dashboard photo load note:', pErr);
          }
        }
        setAppData(currentApp);
        if (currentApp && user?.uid) {
          try {
            localStorage.setItem(`hss_student_app_${user.uid}`, JSON.stringify({
              currentApp,
              applications,
              activeSession,
              cachedAt: Date.now()
            }));
          } catch (_) {}
        }
      } catch (appErr) {
        console.warn('Student applications load note:', appErr);
        let recovered = false;

        // Resilient Fallback 1: Direct client-side Firestore query for student's own record
        try {
          const email = String(user?.email || '').toLowerCase().trim();
          const queries = [
            getDocs(query(collection(db, 'admissions'), where('ownerUid', '==', user.uid)))
          ];
          if (email) {
            queries.push(getDocs(query(collection(db, 'admissions'), where('emailNormalized', '==', email))));
            queries.push(getDocs(query(collection(db, 'admissions'), where('Email Address', '==', email))));
          }
          const snaps = await Promise.all(queries);
          const directApps = [];
          const seenIds = new Set();
          snaps.forEach(snap => {
            snap.forEach(docSnap => {
              if (!seenIds.has(docSnap.id)) {
                seenIds.add(docSnap.id);
                directApps.push({ docId: docSnap.id, ...docSnap.data() });
              }
            });
          });
          if (directApps.length > 0) {
            setAllApplications(directApps);
            const fallbackApp = selectStudentApplication(directApps, activeSession);
            if (fallbackApp) {
              setAppData(fallbackApp);
              setSessionInfo(fallbackApp.Session || fallbackApp.session || activeSession);
              setLoadError(null);
              recovered = true;
              try {
                localStorage.setItem(`hss_student_app_${user.uid}`, JSON.stringify({
                  currentApp: fallbackApp,
                  applications: directApps,
                  activeSession,
                  cachedAt: Date.now()
                }));
              } catch (_) {}
            }
          }
        } catch (directErr) {
          console.warn('Direct Firestore client read fallback note:', directErr);
        }

        // Resilient Fallback 2: Cached application from localStorage
        if (!recovered && user?.uid) {
          try {
            const rawCache = localStorage.getItem(`hss_student_app_${user.uid}`);
            if (rawCache) {
              const cached = JSON.parse(rawCache);
              if (cached?.currentApp) {
                setAppData(cached.currentApp);
                if (cached.applications) setAllApplications(cached.applications);
                if (cached.activeSession) setSessionInfo(cached.activeSession);
                setLoadError(null);
                recovered = true;
                setAlert({
                  type: 'info',
                  text: '⚡ Displaying your confirmed application details from local cache. The server is currently refreshing capacity.'
                });
              }
            }
          } catch (cacheErr) {
            console.warn('Cache fallback read note:', cacheErr);
          }
        }

        if (!recovered) {
          setLoadError(appErr.message || 'Application status could not be loaded.');
        }
      }
    } catch (fsErr) {
      console.error('Firestore student dashboard read error:', fsErr);
      setLoadError('Application status could not be loaded. Please retry.');
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
      const uid = user?.uid || auth?.currentUser?.uid;
      const userEmailClean = (user?.email || auth?.currentUser?.email || '').toLowerCase().trim();

      if (uid) {
        const userDocRef = doc(db, 'users', uid);
        await setDoc(userDocRef, {
          uid: uid,
          email: userEmailClean,
          name: profileName.trim(),
          mobile: profileMobile.trim(),
          residence: profileResidence.trim(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } else if (userEmailClean) {
        const userDocRef = doc(db, 'users', userEmailClean);
        await setDoc(userDocRef, {
          name: profileName.trim(),
          mobile: profileMobile.trim(),
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
  const handleViewPdf = async () => {
    if (!appData) return;
    let dataToPrint = { ...appData };
    const currentPhoto = getStudentPhotoUrl(dataToPrint);
    if (!currentPhoto || currentPhoto === '/logo.png' || currentPhoto.length < 20) {
      try {
        const photo = await fetchStudentPhotoOnDemand(dataToPrint);
        if (photo && photo.length > 20 && photo !== '/logo.png') {
          dataToPrint = {
            ...dataToPrint,
            photo_id: photo,
            photoUrl: photo,
            'Student Photo': photo,
          };
        }
      } catch (_) {}
    }
    generateStudentAdmissionPdf(dataToPrint);
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

  // Execute audited application withdrawal.
  const executeDeleteApplication = async () => {
    if (!appData) return;
    const formNo = appData['Form Number'] || appData['FormNo'] || appData['Form No.'] || appData.docId || appData.id;
    setDeleting(true);
    try {
      const res = await withdrawAdmission(appData.docId || appData.id || String(formNo));
      if (res && res.success !== false) {
        setShowDeleteModal(false);
        setAppData(prev => ({
          ...prev,
          Status: 'Withdrawn',
          status: 'Withdrawn',
          withdrawnAt: new Date().toISOString()
        }));
        setAlert({ type: 'success', text: `Application #${formNo} has been withdrawn. You can now re-apply or edit your application details whenever you are ready.` });
      } else {
        setAlert({ type: 'error', text: res?.error || res?.message || 'Failed to withdraw application.' });
      }
    } catch (err) {
      setAlert({ type: 'error', text: err.message || 'Error withdrawing application.' });
    } finally {
      setDeleting(false);
    }
  };

  // Payment Gateway Configuration
  const [gatewayConfig, setGatewayConfig] = useState({ gatewayMode: 'off' });

  const status = appData?.Status || appData?.status || 'No Application';
  const formNum = appData?.['Form Number'] || 'N/A';
  const classSought = appData?.['Admission sought for class'] || 'N/A';
  const rollNo = appData?.['Class Roll No'] || appData?.['Class Roll No.'] || appData?.RollNo || '';
  const isApprovedByRollNo = Boolean(rollNo && String(rollNo).trim() !== '' && rollNo !== '—' && rollNo !== 'N/A' && status !== 'Rejected' && status !== 'Withdrawn');

  // Detect provisional admission & upgrade history
  const isProvisional =
    appData?.['Admission Type (Class 11th)'] === 'Provisional' ||
    appData?.['Admission Type (Class 12th)'] === 'Provisional' ||
    appData?.['Admission Type'] === 'Provisional' ||
    appData?.isProvisional === true;

  const wasUpgradedFromProvisional = Boolean(
    appData?.upgradedFromProvisional === true ||
    appData?.wasProvisional === true ||
    appData?.upgradedAt
  );

  const editableUntil = appData?.editableUntil;
  const editableUntilMillis = typeof editableUntil === 'object'
    ? Number(editableUntil?._seconds || editableUntil?.seconds || 0) * 1000
    : Date.parse(editableUntil || '') || 0;
  const isWithin3DaysRejection = status === 'Rejected' && (editableUntilMillis > Date.now() || !editableUntil || appData?.isEditable === true);
  const isRejectionExpired = status === 'Rejected' && !isWithin3DaysRejection;

  // Payment Status & Online Payment Toggle
  const paymentMode = gatewayConfig.gatewayMode || 'off';
  const isOnlinePaymentEnabled = paymentMode === 'manual' || paymentMode === 'cashfree' || paymentMode === 'razorpay' || paymentMode === 'online';
  const isPaid = appData?.['Payment Status'] === 'PAID & VERIFIED' || appData?.isPaid === true;

  // Editability Check
  const isFormEditable = status === 'Draft' || isWithin3DaysRejection;

  const applicationRoute = (mode = '') => {
    const key = appData?.docId || appData?.applicationId || appData?.['Form Number'] || appData?.FormNo || appData?.formNo || '';
    const params = new URLSearchParams();
    if (key) params.set('application', String(key));
    if (mode) params.set('mode', mode);
    const query = params.toString();
    return `/portal/student/application${query ? `?${query}` : ''}`;
  };

  const handleConvertToFull = () => {
    if (!appData) return;
    navigate(applicationRoute('upgrade'));
  };

  return (
    <div className="portal-page student-mobile-compact w-full min-h-[85vh] py-3 px-2 sm:py-4 sm:px-4" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="Student Dashboard"
        description="Govt HSS Shangus Online Student Admission Portal Dashboard."
        path="/portal/student"
      />

      <div className="max-w-5xl mx-auto space-y-4">
        {/* Top Welcome Hero Card */}
        <div className="rounded-2xl p-4 sm:p-5 border shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
          <div className="flex min-w-0 items-center gap-3">
            {(() => {
              const studentAvatarPhoto = appData ? (formatPhotoDisplayUrl(getStudentPhotoUrl(appData)) || formatPhotoDisplayUrl(appData.photo_id)) : '';
              if (studentAvatarPhoto && studentAvatarPhoto !== '/logo.png' && studentAvatarPhoto.length > 20) {
                return (
                  <img
                    src={studentAvatarPhoto}
                    alt={user?.name || 'Student'}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-teal-500/40 shadow-xs flex-shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                );
              }
              return (
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center font-extrabold text-xl text-teal-600 flex-shrink-0">
                  {(user?.name || 'S').charAt(0).toUpperCase()}
                </div>
              );
            })()}

            <div className="min-w-0 space-y-1">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600">
                <ShieldCheck size={12} /> Student Account
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold" style={{ color: 'var(--text-main, #0f172a)' }}>
                Welcome, {user?.name || 'Student'}
              </h1>
              <div className="flex items-center gap-2 flex-wrap text-xs font-medium" style={{ color: 'var(--text-muted, #64748b)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 break-all">{user?.email}</span>
                  {isEmailVerified ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-500/30" title="Email is verified for password recovery">
                      <CheckCircle2 size={10} className="text-emerald-500" />
                      <span>Verified</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileName(user?.name || '');
                        setProfileMobile(user?.mobile || '');
                        setProfileResidence(user?.residence || '');
                        setShowEditProfile(true);
                      }}
                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer transition-colors"
                      title="Click to verify email in Profile & Account settings"
                    >
                      <AlertCircle size={10} className="text-amber-500" />
                      <span>Unverified</span>
                    </button>
                  )}
                </span>
                <span>•</span>
                <span>{user?.mobile || 'No Phone registered'}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Header Controls */}
          <div className="grid grid-cols-2 items-stretch gap-2 w-full md:flex md:w-auto">
            <button
              onClick={() => {
                setProfileName(user?.name || '');
                setProfileMobile(user?.mobile || '');
                setProfileResidence(user?.residence || '');
                setShowEditProfile(true);
              }}
              className="relative px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-2xs"
              style={{ borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #334155)', backgroundColor: 'var(--bg-card, #ffffff)' }}
              title="Manage student profile and account recovery security"
            >
              <UserCog size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Profile & Account</span>
              {!isEmailVerified && user?.email && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Action recommended: Verify email" />
              )}
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
            moduleKey="student"
            text="Loading Student Dashboard"
            subtext="Loading your application status…"
          />
        ) : loadError ? (
          <section role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-slate-900 space-y-3">
            <h2 className="font-bold">Application status unavailable</h2>
            <p className="text-sm">We could not retrieve your application. This does not mean your submission failed. Please do not submit another form.</p>
            <p className="text-xs">{loadError}</p>
            <button type="button" onClick={loadDashboardData} className="rounded-lg bg-teal-700 text-white px-4 py-2 text-sm">Retry loading application</button>
          </section>
        ) : (
          /* Application Status Box */
          <div className="rounded-xl sm:rounded-3xl p-3 sm:p-8 border shadow-sm sm:shadow-xl space-y-3 sm:space-y-6" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
            <div className="flex flex-col items-start justify-between gap-2 border-b pb-4 sm:flex-row sm:items-center" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
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
                  : status === 'Withdrawn'
                  ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                  : 'bg-slate-500/15 text-slate-600 border border-slate-500/30'
              }`}>
                {status === 'Submitted' && <CheckCircle2 size={13} />}
                {status === 'Draft' && <Clock size={13} />}
                {status === 'Rejected' && <AlertCircle size={13} />}
                {status === 'Withdrawn' && <AlertCircle size={13} />}
                <span>{status === 'Withdrawn' ? 'ADM. WITHDRAWN' : status}</span>
              </div>
            </div>

            {/* Multiple Submitted Applications Switcher */}
            {allApplications.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10.5px] font-black text-slate-500 dark:text-slate-400 uppercase px-1.5 whitespace-nowrap">
                    Your Applications ({allApplications.length}):
                  </span>
                  {allApplications.map((app, idx) => {
                    const isCurrent = (app.docId || app['Form Number'] || idx) === (appData?.docId || appData?.['Form Number'] || 0);
                    const appFNum = app['Form Number'] || app.formNo || app.docId || `#${idx + 1}`;
                    const appCls = app['Admission sought for class'] || app.class || 'N/A';
                    const appStrm = app['Stream for Class 11th'] || app['Stream opted in Class 11th'] || app.Stream || '';
                    return (
                      <button
                        key={app.docId || idx}
                        type="button"
                        onClick={() => {
                          setAppData(app);
                          if (app.Session || app.session || app['Academic Session']) {
                            setSessionInfo(app.Session || app.session || app['Academic Session']);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                          isCurrent
                            ? 'bg-teal-600 text-white shadow-xs font-black'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span>Form #{appFNum}</span>
                        <span className="text-[10px] opacity-80">(Class {appCls}{appStrm ? ` • ${appStrm}` : ''})</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/portal/student/application')}
                  className="px-3 py-1.5 rounded-xl font-bold text-[11px] text-teal-700 dark:text-teal-300 hover:bg-teal-500/10 transition-all flex items-center gap-1 whitespace-nowrap sm:ml-auto"
                  title="Submit another admission form"
                >
                  <Plus size={13} />
                  <span>Apply for Another Class</span>
                </button>
              </div>
            )}

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
                    <div className={`font-extrabold text-sm mt-0.5 ${isApprovedByRollNo ? 'text-emerald-600 font-black' : 'text-slate-400'}`}>
                      {isApprovedByRollNo ? `#${rollNo}` : 'Pending Assignment'}
                    </div>
                  </div>
                </div>

                {/* Convert Provisional → Full Admission Banner */}
                {isProvisional && (status === 'Submitted' || status === 'Approved') && (
                  <div className="p-5 rounded-2xl border animate-fadeIn" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fff7ed 100%)', borderColor: '#f59e0b' }}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7', border: '1.5px solid #f59e0b' }}>
                          <span style={{ fontSize: 20 }}>📋</span>
                        </div>
                        <div>
                          <div className="text-sm font-extrabold" style={{ color: '#92400e' }}>
                            🎓 Provisional Admission Active — Convert to Full Admission
                          </div>
                          <div className="text-xs mt-1 leading-relaxed" style={{ color: '#b45309' }}>
                            Got your Class {classSought === '12th' ? '11th' : '10th'} result? Submit your mark sheet and upgrade your provisional admission to a <strong>Full (Regular) Admission</strong> now. Your details are pre-filled.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={handleConvertToFull}
                          className="px-5 py-2.5 rounded-xl font-extrabold text-xs text-white flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                          style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                          <ArrowRight size={15} />
                          Convert → Full Admission
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 p-3 rounded-xl text-[11px] leading-relaxed" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                      ⚠ <strong>Reminder:</strong> Original mark sheet must be submitted within <strong>30 days</strong> of result declaration. Attendance counts only after conversion to Full Admission.
                    </div>
                  </div>
                )}

                {/* Upgraded From Provisional History Confirmation Badge */}
                {wasUpgradedFromProvisional && !isProvisional && (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fadeIn">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                        ✓
                      </div>
                      <div>
                        <div className="font-extrabold text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5">
                          <span>Full (Regular) Admission</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 text-[10px] font-black">
                            Upgraded
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                          Your admission record confirms successful transition from provisional to full (regular) admission status.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Guidance Banner */}
                <div className={`p-4 rounded-2xl text-xs font-medium leading-relaxed ${
                  status === 'Withdrawn'
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300'
                    : isApprovedByRollNo
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                    : status === 'Draft'
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300'
                    : status === 'Rejected'
                    ? isWithin3DaysRejection
                      ? 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300'
                      : 'bg-red-900/10 border border-red-900/20 text-red-900 dark:text-red-400'
                    : 'bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300'
                }`}>
                  {status === 'Withdrawn' ? (
                    <span>⚠️ <strong>Application Online Withdrawn:</strong> Your admission application (Form #{formNum}) was online withdrawn and is under official admin review for data cleanup. You can submit a new online admission application below whenever ready.</span>
                  ) : isApprovedByRollNo ? (
                    <span>🎉 <strong>ADMISSION APPROVED!</strong> You have been officially assigned Class Roll No. <strong>#{rollNo}</strong>. Welcome to Govt HSS Shangus!</span>
                  ) : status === 'Draft' ? (
                    <span>You have a saved draft application. Click <strong>"Continue Application"</strong> below to complete your admission form and submit.</span>
                  ) : status === 'Rejected' ? (
                    isWithin3DaysRejection ? (
                      <span>⚠️ Application returned for correction: <strong className="text-red-600 dark:text-red-400">{appData.rejectionReason || appData['Rejection Reason'] || appData['Rejected Reason'] || 'Please check specified details.'}</strong>. You have <strong>3 days</strong> to edit and resubmit your application below. {isPaid ? ' (Your online fee payment remains intact).' : ''}</span>
                    ) : (
                      <span>🚫 <strong>Correction Window Expired:</strong> The 3-day window to edit this rejected application has passed. Please contact the admission office to request unlock.</span>
                    )
                  ) : (
                    <span>Your application has been received successfully and is under official verification. Admin approval will be confirmed upon Class Roll No assignment.</span>
                  )}
                </div>

                {/* Online Payment Action Card (If Online Payment Enabled & Fee Pending) */}
                {isOnlinePaymentEnabled && !isPaid && status !== 'Draft' && status !== 'Withdrawn' && (
                  <div className="p-4 sm:p-5 rounded-2xl border bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-amber-500/10 border-teal-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
                        <CreditCard size={18} className="text-teal-600" />
                        <span>Online Admission Fee Payment Required</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Complete your online fee payment to verify receipt and unlock your official printable PDF form.
                      </p>
                    </div>
                    <button
                      onClick={() => setAlert({ type: 'info', text: 'Online Fee Payment gateway is ready. Scan QR code or enter transaction ID at counter.' })}
                      className="px-5 py-2.5 rounded-xl font-extrabold text-xs text-white bg-teal-600 hover:bg-teal-500 shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <CreditCard size={15} /> Pay Fee ({appData['Fee Amount'] || 'Govt Fee'})
                    </button>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {status === 'Withdrawn' ? (
                    <button
                      onClick={() => {
                        try {
                          const uid = user?.uid || 'guest';
                          sessionStorage.removeItem(`hss_student_draft_${uid}`);
                          sessionStorage.removeItem('hss_student_draft_guest');
                          sessionStorage.removeItem('hss_student_draft_local');
                          sessionStorage.removeItem('hss_admission_draft');
                          sessionStorage.removeItem('hss_admission_upgrade');
                        } catch (e) {}
                        navigate('/portal/student/application');
                      }}
                      className="px-6 py-3.5 rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer bg-teal-600 hover:bg-teal-500 text-white"
                    >
                      <Edit3 size={16} />
                      <span>Start New Online Admission Application</span>
                      <ArrowRight size={16} />
                    </button>
                  ) : status === 'Draft' ? (
                    <button
                      onClick={() => navigate(applicationRoute())}
                      className="px-6 py-3.5 rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer bg-teal-600 hover:bg-teal-500 text-white"
                    >
                      <Edit3 size={16} />
                      <span>Continue Draft Application</span>
                      <ArrowRight size={16} />
                    </button>
                  ) : isFormEditable ? (
                    <button
                      onClick={() => navigate(applicationRoute())}
                      disabled={isRejectionExpired}
                      className={`px-6 py-3.5 rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                        isRejectionExpired ? 'bg-slate-400 text-slate-200 cursor-not-allowed opacity-60' : 'bg-teal-600 hover:bg-teal-500 text-white'
                      }`}
                    >
                      <Edit3 size={16} />
                      <span>Edit Application Details (Correction Mode)</span>
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={isProvisional ? () => generateProvisionalAdmissionPdf(appData) : handleViewPdf}
                      className="px-6 py-3.5 rounded-2xl font-extrabold text-xs border flex items-center gap-2 cursor-pointer transition-all shadow-md hover:scale-[1.02] active:scale-[0.98]"
                      style={isProvisional
                        ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', borderColor: '#d97706' }
                        : { background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#ffffff', borderColor: '#0f766e' }
                      }
                      title={isProvisional ? "Print Provisional Slip" : "Print Admission Form"}
                    >
                      <Printer size={17} />
                      <span>{isProvisional ? 'Print Provisional Slip' : 'Print Admission Form'}</span>
                    </button>
                  )}

                  {['Draft', 'Submitted', 'Rejected'].includes(status) && (
                    <button
                      onClick={handleDeleteMyApplication}
                      className="px-4 py-3.5 rounded-2xl font-bold text-xs border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 cursor-pointer transition-all ml-auto"
                      title="Withdraw this application and apply afresh"
                    >
                      <Trash2 size={15} />
                      <span>Withdraw & Apply Afresh</span>
                    </button>
                  )}
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

      {/* Profile & Account Settings Modal */}
      {showEditProfile && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn overflow-y-auto">
          <div
            className="w-full max-w-lg rounded-2xl sm:rounded-3xl p-5 sm:p-6 border shadow-2xl space-y-4 animate-scaleUp my-auto text-slate-900 dark:text-slate-100"
            style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3.5 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 flex-shrink-0">
                  <UserCog size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-base tracking-tight truncate" style={{ color: 'var(--text-main, #0f172a)' }}>
                    Profile & Account Settings
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    Manage contact info & account security
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfile(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Account Recovery & Email Security Card */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Account Recovery & Security
              </span>

              {isEmailVerified ? (
                <div className="p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                      <ShieldCheck size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-emerald-900 dark:text-emerald-100 truncate">{user?.email}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          Verified
                        </span>
                      </div>
                      <p className="text-[10.5px] text-emerald-700/90 dark:text-emerald-400">
                        Self-service password recovery is enabled and secure.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 space-y-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-amber-500/30">
                      <Mail size={15} />
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-xs text-amber-900 dark:text-amber-100 truncate">{user?.email}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                          Unverified
                        </span>
                      </div>
                      <p className="text-[10.5px] text-amber-800/90 dark:text-amber-300 leading-tight">
                        Verify <strong className="underline decoration-amber-500/50">{user?.email}</strong> to secure self-service password recovery.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-500/20 flex-wrap">
                    <button
                      type="button"
                      onClick={handleRefreshVerificationStatus}
                      className="px-2.5 py-1 rounded-xl border border-amber-500/40 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 hover:bg-amber-500/15 font-bold text-[10.5px] cursor-pointer transition-all shadow-2xs"
                      title="Check if you have clicked the link in your inbox"
                    >
                      Check Status ↻
                    </button>
                    <button
                      type="button"
                      disabled={sendingVerification || verificationCooldown > 0}
                      onClick={handleSendVerificationEmail}
                      className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[10.5px] shadow-2xs cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {sendingVerification ? (
                        <>
                          <RefreshCw size={11} className="animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Mail size={11} />
                          <span>{verificationCooldown > 0 ? `Resend in ${verificationCooldown}s` : 'Send Verification Link'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Information Form */}
            <form onSubmit={handleSaveProfile} className="space-y-3 pt-1 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Personal & Contact Details
              </span>

              <div className="space-y-1">
                <label className="font-bold block" style={{ color: 'var(--text-main, #1e293b)' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold block" style={{ color: 'var(--text-main, #1e293b)' }}>Mobile Number *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={profileMobile}
                  onChange={(e) => setProfileMobile(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold block" style={{ color: 'var(--text-main, #1e293b)' }}>Residence Address</label>
                <input
                  type="text"
                  value={profileResidence}
                  onChange={(e) => setProfileResidence(e.target.value)}
                  placeholder="Village / Town, District"
                  className="w-full px-3.5 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditProfile(false)}
                  className="px-4 py-2 rounded-xl font-bold border cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  style={{ borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #334155)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-xl font-extrabold text-white bg-teal-600 hover:bg-teal-500 shadow-md cursor-pointer disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {savingProfile ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Profile Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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
                    Withdraw Application & Start Afresh?
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
                <span>Important withdrawal details:</span>
              </div>
              <ul className="space-y-2 pt-1">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Official withdrawal:</strong> The application will no longer be active, while its audit record remains available to the admission office.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Form number retained:</strong> Form number <strong>#{appData?.['Form Number'] || appData?.['FormNo']}</strong> will not be reassigned to another student.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>New application:</strong> You may start a fresh application after withdrawal. Previously submitted details will not be copied automatically.</span>
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
                I understand and confirm that I want to withdraw this application and start a fresh form.
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
                    <span>Withdrawing Application...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Yes, Withdraw & Apply Afresh</span>
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
