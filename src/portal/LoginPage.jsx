import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useLocation, Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Eye, EyeOff, Lock, User, GraduationCap, UserCheck, 
  AlertCircle, CheckCircle, ArrowRight, RefreshCw, Crown, Sparkles, 
  KeyRound, Mail, School, Award, CheckCircle2, ChevronRight, Compass,
  Send, ExternalLink, ArrowLeft, ShieldAlert, X
} from 'lucide-react';
import SEO from '../components/SEO';
import ModernLoader from '../components/ModernLoader';
import { auth, db, googleProvider } from '../services/firebase';
import { 
  getIdTokenResult, 
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword, 
  signOut, 
  fetchSignInMethodsForEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  requireVerifiedAdminSession,
  resolveStaffRoleAndPerms, 
  createAdminLoginHandshake,
  approveAdminLoginHandshake,
  consumeAdminLoginHandshake,
  sendAdminSignInVerificationLink,
  incrementTeacherLoginCount,
  recordTeacher2StepVerification,
  isBootstrapSuperAdminEmail,
  isBootstrapAdminEmail,
  isSuperAdminEmail,
  FALLBACK_STAFF_PROFILES
} from '../services/staffAuthService';
import { sessionManager } from '../services/sessionManager';
import ModernCaptcha from '../components/ModernCaptcha';
import { normalizeTeacherClasses } from '../utils/practicalsSettingsManager';
import { loadSiteSettings } from '../utils/settingsLoader';

// Helper to quickly check if an email belongs to a teacher/faculty
const isLikelyTeacherEmail = (rawEmail) => {
  const clean = String(rawEmail || '').trim().toLowerCase();
  if (!clean || !clean.includes('@')) return false;
  if (clean === 'socialshiftz@gmail.com') return true;
  if (FALLBACK_STAFF_PROFILES[clean]?.isTeacher || FALLBACK_STAFF_PROFILES[clean]?.role === 'Teacher') return true;
  try {
    const rawSession = sessionStorage.getItem(`hss_staff_profile_${clean}`);
    if (rawSession && JSON.parse(rawSession)?.profile?.isTeacher) return true;
  } catch (_) {}
  return false;
};

// Distinct chromatic theme specifications for each role tab
export const ROLE_THEMES = Object.freeze({
  student: {
    tabActive: 'bg-blue-600 text-white shadow-sm font-black',
    tabHover: 'hover:text-blue-600 dark:hover:text-blue-400',
    cardBorder: 'border-blue-500/30 shadow-blue-500/10',
    iconFocus: 'group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400',
    inputFocus: 'focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15',
    checkbox: 'text-blue-600 focus:ring-blue-500',
    link: 'text-blue-600 dark:text-blue-400 hover:underline',
    btnGradient: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/25',
    btnLabel: 'Sign In as STUDENT',
  },
  teacher: {
    tabActive: 'bg-emerald-600 text-white shadow-sm font-black',
    tabHover: 'hover:text-emerald-600 dark:hover:text-emerald-400',
    cardBorder: 'border-emerald-500/30 shadow-emerald-500/10',
    iconFocus: 'group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400',
    inputFocus: 'focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15',
    checkbox: 'text-emerald-600 focus:ring-emerald-500',
    link: 'text-emerald-600 dark:text-emerald-400 hover:underline',
    btnGradient: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25',
    btnLabel: 'Sign In as TEACHER',
  },
  admin: {
    tabActive: 'bg-amber-600 text-white shadow-sm font-black',
    tabHover: 'hover:text-amber-600 dark:hover:text-amber-400',
    cardBorder: 'border-amber-500/30 shadow-amber-500/10',
    iconFocus: 'group-focus-within:text-amber-600 dark:group-focus-within:text-amber-400',
    inputFocus: 'focus:border-amber-600 dark:focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15',
    checkbox: 'text-amber-600 focus:ring-amber-500',
    link: 'text-amber-600 dark:text-amber-400 hover:underline',
    btnGradient: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/25',
    btnLabel: 'Sign In as STANDARD ADMIN',
  },
  superadmin: {
    tabActive: 'bg-purple-600 text-white shadow-sm font-black',
    tabHover: 'hover:text-purple-600 dark:hover:text-purple-400',
    cardBorder: 'border-purple-500/30 shadow-purple-500/10',
    iconFocus: 'group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400',
    inputFocus: 'focus:border-purple-600 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15',
    checkbox: 'text-purple-600 focus:ring-purple-500',
    link: 'text-purple-600 dark:text-purple-400 hover:underline',
    btnGradient: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/25',
    btnLabel: 'Sign In as SUPERADMIN',
  },
});

export default function LoginPage() {
  const { onLoginSuccess, isAuthenticated, user } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();

  // Tab role selection: 'student' | 'teacher' | 'admin' | 'superadmin'
  const [selectedRole, setSelectedRole] = useState(() => {
    try {
      if (sessionStorage.getItem('hss_explicit_logout') !== 'true' && localStorage.getItem('hss_explicit_logout') !== 'true') {
        const pending = localStorage.getItem('hss_pending_admin_login');
        if (pending) {
          const parsed = JSON.parse(pending);
          if (parsed.email && Date.now() - parsed.ts < 15 * 60 * 1000) {
            return parsed.role === 'SuperAdmin' ? 'superadmin' : 'admin';
          }
        }
      }
    } catch (_) {}
    return 'student';
  });

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [captchaToken, setCaptchaToken] = useState(null);

  // 2-Step Verification Link State for Admin / SuperAdmin (Window 1 waiting state)
  const [emailLinkSentState, setEmailLinkSentState] = useState(() => {
    try {
      if (sessionStorage.getItem('hss_explicit_logout') === 'true' || localStorage.getItem('hss_explicit_logout') === 'true') {
        localStorage.removeItem('hss_pending_admin_login');
        localStorage.removeItem('emailForSignIn');
        localStorage.removeItem('hss_admin_auth_approved');
        return null;
      }
      const pending = localStorage.getItem('hss_pending_admin_login');
      if (pending) {
        const parsed = JSON.parse(pending);
        if (parsed.email && Date.now() - parsed.ts < 15 * 60 * 1000) {
          return { email: parsed.email, handshakeId: parsed.handshakeId, sentAt: parsed.ts, role: parsed.role || 'Admin' };
        }
      }
    } catch (_) {}
    return null;
  });
  const [resendCooldown, setResendCooldown] = useState(0);

  // Window 2: Successful verification confirmation state (when link was clicked in this tab)
  const [window2VerifiedState, setWindow2VerifiedState] = useState(null);
  const [closeTabNote, setCloseTabNote] = useState(false);

  // Permanent flag for this tab: if opened via verification link, NEVER redirect to dashboard
  const isEmailVerificationTabRef = useRef(
    window.location.hash.includes('staff_challenge=') ||
    isSignInWithEmailLink(auth, window.location.href) || 
    window.location.search.includes('email_link_verify') || 
    window.location.search.includes('oobCode') ||
    window.location.search.includes('apiKey')
  );
  // Ref guard to prevent double-execution in React StrictMode
  const emailLinkProcessingRef = useRef(false);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(() => {
    const terminated = location.state?.terminated || sessionStorage.getItem('hss_session_terminated');
    if (terminated) {
      try { sessionStorage.removeItem('hss_session_terminated'); } catch (_) {}
      return {
        type: 'error',
        text: '⚠️ Session Terminated: Your account was logged in on another device. All previous sessions have been cleared for security.'
      };
    }
    const msg = location.state?.message;
    if (msg && !msg.toLowerCase().includes('no longer valid') && !msg.toLowerCase().includes('expired')) {
      return { type: 'error', text: msg };
    }
    return null;
  });

  const isSuperAdmin = selectedRole === 'superadmin';
  const activeTheme = ROLE_THEMES[selectedRole] || ROLE_THEMES.student;

  // If user is already authenticated, automatically redirect to their dashboard (Except when in Window 2 verification gateway or waiting for 2-step verification)
  useEffect(() => {
    if (isEmailVerificationTabRef.current || window2VerifiedState || emailLinkSentState || localStorage.getItem('hss_pending_admin_login')) {
      return;
    }

    if (isAuthenticated && user?.role) {
      const roleKey = String(user.role).toLowerCase().trim();
      const dest =
        roleKey === 'student' ? '/portal/student'
        : (roleKey === 'teacher' || roleKey === 'faculty') ? '/portal/teacher'
        : '/portal/admin';
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, user, navigate, window2VerifiedState, emailLinkSentState]);

  // When Window 2 is opened via verification link, it stays on confirmation screen so the waiting device logs in.

  // Pre-warm dashboard bundle chunks in background during idle time for 0ms instant dashboard mounting
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const preloadDashboards = () => {
      import('./admin/AdminDashboard').catch(() => {});
      import('./teacher/TeacherDashboard').catch(() => {});
      import('./student/StudentDashboard').catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(preloadDashboards, { timeout: 1200 });
    } else {
      setTimeout(preloadDashboards, 400);
    }
  }, []);

  // Cooldown countdown timer for resend verification link
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Window 2 verification confirmation:
  // Strictly acts as a verification gateway and NEVER automatically redirects to the dashboard.
  // The original requester window (Window 1) will detect the approval in real-time and load the dashboard.


  // Helper to construct verified user session
  const createVerifiedSession = async (firebaseUser, overrideEmail = null, cachedStaffProfile = null) => {
    let activeUser = firebaseUser || auth.currentUser;
    if (!activeUser?.uid) {
      // If user is resolving, wait briefly for auth state to populate
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 200));
        if (auth.currentUser) {
          activeUser = auth.currentUser;
          break;
        }
      }
    }
    if (!activeUser?.uid) throw new Error('Please sign in again to verify your session.');
    const tokenResult = await getIdTokenResult(activeUser, false);
    const claims = tokenResult.claims || {};
    const emailLower = String(activeUser?.email || overrideEmail || '').toLowerCase().trim();
    
    // Resolve role from Firestore permissions & users collection & bootstrap (force fresh on login)
    const isBootstrapAdmin = (activeUser.emailVerified && isBootstrapSuperAdminEmail(emailLower)) || isBootstrapAdminEmail(emailLower);
    const staffProfile = cachedStaffProfile || await resolveStaffRoleAndPerms(emailLower, true);

    const rawRole = staffProfile?.role || 'Student';

    const role = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
    const normalizedRole = role.toLowerCase();
    if (normalizedRole.includes('admin')) await requireVerifiedAdminSession(activeUser);

    const isSuper = (activeUser.emailVerified && isBootstrapSuperAdminEmail(emailLower)) || isSuperAdminEmail(emailLower) || role === 'SuperAdmin';
    const perms = isSuper
      ? ['*']
      : (Array.isArray(staffProfile?.perms) && staffProfile.perms.length > 0)
        ? staffProfile.perms
        : (Array.isArray(claims.permissions) && claims.permissions.length > 0)
          ? claims.permissions
          : (isBootstrapAdmin ? ['reports'] : []);

    const sessionId = sessionManager.generateSessionId();
    sessionManager.setSessionId(sessionId);

    const assignedClasses = normalizeTeacherClasses(
      Array.isArray(staffProfile?.assignedClasses)
        ? staffProfile.assignedClasses
        : (staffProfile?.assignedClass ? [staffProfile.assignedClass] : [])
    );
    const assignedSubjects = Array.isArray(staffProfile?.assignedSubjects) && staffProfile.assignedSubjects.length > 0
      ? staffProfile.assignedSubjects
      : (staffProfile?.subject ? String(staffProfile.subject).split(/[,;]+/).map(s => s.trim()).filter(Boolean) : []);

    const resolvedUser = {
      email: emailLower,
      name: staffProfile?.name || activeUser?.displayName || emailLower.split('@')[0],
      role,
      perms,
      subject: staffProfile?.subject || staffProfile?.teachingSubject || '',
      teachingSubject: staffProfile?.teachingSubject || staffProfile?.subject || '',
      assignedSubjects,
      assignedClasses,
      classSubjectMap: staffProfile?.classSubjectMap || null,
      tierSubjects: staffProfile?.tierSubjects || null,
      mobile: staffProfile?.mobile || '',
      photoURL: activeUser?.photoURL || null,
      uid: activeUser?.uid || 'admin_handshake_auth',
    };

    if (activeUser?.uid && activeUser.uid !== 'admin_handshake_auth') {
      await sessionManager.registerActiveSessionInCloud(resolvedUser, sessionManager.getDeviceId(), sessionId);
    }

    return {
      user: resolvedUser,
      token: tokenResult?.token || 'verified_handshake_token',
      sessionId,
    };
  };

  // =========================================================================
  // WINDOW 1 LISTENER: Real-Time Handshake Sync (BroadcastChannel + LocalStorage + Firestore Snapshot)
  // Automatically unlocks & transitions the original login tab when verified anywhere!
  // =========================================================================
  useEffect(() => {
    // CRITICAL: If this tab was opened via an email verification link (Window 2),
    // it must NEVER act as a Window 1 listener. Skip entirely.
    if (isEmailVerificationTabRef.current) return;

    if (!emailLinkSentState?.email) return;
    const cleanEmail = String(emailLinkSentState.email).trim().toLowerCase();
    const handshakeId = emailLinkSentState.handshakeId;

    let isHandled = false;
    const handleAuthApproved = async (sourceInfo = {}) => {
      if (isHandled) return;
      isHandled = true;
      
      const isTeacher = emailLinkSentState?.role === 'Teacher';
      setAlert({ 
        type: 'success', 
        text: isTeacher 
          ? '🛡️ 2-Step Verification Completed! Unlocking Teacher Portal...' 
          : '🛡️ 2-Step Verification Completed! Unlocking Admin Portal...' 
      });

      try {
        // 1. Check if Firebase Auth session was established on same device
        let currentUser = auth.currentUser;
        if (!currentUser) {
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 250));
            if (auth.currentUser) {
              currentUser = auth.currentUser;
              break;
            }
          }
        }

        const staffProfile = await resolveStaffRoleAndPerms(cleanEmail);
        const verifiedSession = await createVerifiedSession(currentUser, cleanEmail, staffProfile);
        
        if (cleanEmail && (staffProfile?.role === 'Teacher' || staffProfile?.role === 'Faculty')) {
          await recordTeacher2StepVerification(cleanEmail);
        }

        if (handshakeId) {
          await consumeAdminLoginHandshake(handshakeId).catch(() => {});
        }
        localStorage.removeItem('emailForSignIn');
        localStorage.removeItem('hss_pending_admin_login');
        localStorage.removeItem('hss_admin_auth_approved');
        setEmailLinkSentState(null);

        setTimeout(() => {
          onLoginSuccess(verifiedSession, true);
        }, 400);
      } catch (err) {
        console.error('Real-time handshake unlock error:', err);
        // Fallback: If auth.currentUser exists and is verified, establish session directly
        if (auth.currentUser) {
          try {
            const staffProfile = await resolveStaffRoleAndPerms(cleanEmail);
            const fallbackSession = {
              user: {
                email: cleanEmail,
                name: staffProfile?.name || cleanEmail.split('@')[0],
                role: staffProfile?.role || 'Admin',
                perms: staffProfile?.perms || (isSuperAdminEmail(cleanEmail) ? ['*'] : ['reports']),
                uid: auth.currentUser.uid,
              },
              token: await auth.currentUser.getIdToken().catch(() => 'verified_token'),
            };
            onLoginSuccess(fallbackSession, true);
            return;
          } catch (_) {}
        }
        setAlert({ 
          type: 'error', 
          text: 'Verified handshake received, but session resolution failed. Please refresh or sign in.' 
        });
      }
    };

    // 1. BroadcastChannel Listener (Instant 0ms sync when verified in another tab on the same browser)
    let bc = null;
    try {
      bc = new BroadcastChannel('hss_admin_auth_sync');
      bc.onmessage = (event) => {
        const data = event.data;
        if (data?.type === 'ADMIN_AUTH_APPROVED') {
          if (!cleanEmail || String(data.email || '').trim().toLowerCase() === cleanEmail) {
            handleAuthApproved({ source: 'BroadcastChannel' });
          }
        }
      };
    } catch (_) {}

    // 2. Storage event listener (Cross-tab sync within same origin)
    const handleStorageChange = (e) => {
      if (e.key === 'hss_admin_auth_approved' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (!cleanEmail || String(parsed.email || '').trim().toLowerCase() === cleanEmail) {
            handleAuthApproved({ source: 'StorageEvent' });
          }
        } catch (_) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Polling fallback for localStorage (In case storage event was dropped)
    const storagePollInterval = setInterval(() => {
      try {
        const approved = localStorage.getItem('hss_admin_auth_approved');
        if (approved) {
          const parsed = JSON.parse(approved);
          if (Date.now() - parsed.ts < 10 * 60 * 1000) {
            if (!cleanEmail || String(parsed.email || '').trim().toLowerCase() === cleanEmail) {
              handleAuthApproved({ source: 'StoragePolling' });
            }
          }
        }
      } catch (_) {}
    }, 600);

    // 4. Real-Time Firestore Handshake Listener (For Mobile Phone & Cross-Device email link clicks!)
    let unsubDoc = null;
    if (handshakeId) {
      try {
        unsubDoc = onSnapshot(doc(db, 'adminAuthHandshakes', handshakeId), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.status === 'approved' && String(data.email || '').trim().toLowerCase() === cleanEmail) {
              handleAuthApproved({ uid: data.uid, source: 'FirestoreHandshake' });
            }
          }
        }, (err) => {
          console.warn('Handshake snapshot note:', err);
        });
      } catch (fsErr) {
        console.warn('Firestore onSnapshot handshake error:', fsErr);
      }
    }

    return () => {
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(storagePollInterval);
      if (unsubDoc) unsubDoc();
    };
  }, [emailLinkSentState, onLoginSuccess]);

  // WINDOW 2 VERIFIER: Check on mount if current URL is an Email Sign-In verification link
  const proofStartedRef = useRef(false);
  useEffect(() => {
    // 1. Standard Firebase Auth Email Sign-In Link (Free on Spark Plan)
    if (isSignInWithEmailLink(auth, window.location.href)) {
      if (emailLinkProcessingRef.current) return;
      emailLinkProcessingRef.current = true;

      setIsLoading(true);
      const searchParams = new URLSearchParams(window.location.search);
      let emailForSignIn = window.localStorage.getItem('emailForSignIn');
      if (!emailForSignIn) {
        emailForSignIn = searchParams.get('admin_email');
      }
      if (!emailForSignIn) {
        emailForSignIn = window.prompt('Please confirm your Admin email address to complete 2-Step Login:');
      }

      const handshakeId = searchParams.get('handshake');

      if (emailForSignIn) {
        const cleanEmail = emailForSignIn.trim().toLowerCase();
        signInWithEmailLink(auth, cleanEmail, window.location.href)
          .then(async (userCred) => {
            const staffProfile = await resolveStaffRoleAndPerms(cleanEmail);
            const roleName = staffProfile?.role || 'Admin';
            if (roleName === 'Teacher' || roleName === 'Faculty') {
              await recordTeacher2StepVerification(cleanEmail);
            }

            // Approve handshake in Firestore (Unlocks Window 1 on desktop or phone immediately!)
            if (handshakeId) {
              await approveAdminLoginHandshake(handshakeId, cleanEmail, userCred.user);
            }

            // Clean URL immediately so page refreshes/pull-to-refresh on phones do not re-run with expired code
            try {
              window.history.replaceState(null, '', window.location.pathname);
            } catch (_) {}

            // Save approval to localStorage for same-origin cross-tab sync
            try {
              localStorage.setItem('hss_admin_auth_approved', JSON.stringify({
                email: cleanEmail,
                uid: userCred.user.uid,
                handshakeId,
                ts: Date.now()
              }));
            } catch (_) {}

            // Broadcast approval to all same-browser tabs
            try {
              const bc = new BroadcastChannel('hss_admin_auth_sync');
              bc.postMessage({
                type: 'ADMIN_AUTH_APPROVED',
                email: cleanEmail,
                uid: userCred.user.uid,
                handshakeId,
                ts: Date.now()
              });
              bc.close();
            } catch (_) {}

            // Build verified session so this window can directly open the dashboard
            const verifiedSession = await createVerifiedSession(userCred.user, cleanEmail, staffProfile);
            const redirectPath = (roleName === 'Teacher' || roleName === 'Faculty') ? '/portal/teacher' : '/portal/admin';
            verifiedSession.redirectPath = redirectPath;

            // Immediately clear pending login locks so neither Window 1 nor Window 2 gets blocked
            localStorage.removeItem('hss_pending_admin_login');
            localStorage.removeItem('emailForSignIn');
            sessionStorage.removeItem('hss_auth_handshake_id');

            setWindow2VerifiedState({
              email: cleanEmail,
              role: roleName,
              time: new Date().toLocaleTimeString(),
              handshakeId,
              verifiedSession,
              redirectPath,
            });
          })
          .catch((err) => {
            console.error('Window 2 Email Link sign-in error:', err);
            emailLinkProcessingRef.current = false;
            setAlert({
              type: 'error',
              text: 'The 2-step verification link is invalid, expired, or has already been used. Please sign in again.'
            });
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        emailLinkProcessingRef.current = false;
        setIsLoading(false);
      }
      return;
    }

    // 2. Fallback: Hash fragment challenge proof
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const handshakeId = parameters.get('staff_challenge');
    const proof = parameters.get('proof');
    if (!handshakeId || !proof || proofStartedRef.current) return;
    proofStartedRef.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    setIsLoading(true);
    approveAdminLoginHandshake(handshakeId, proof).then(result => {
      setWindow2VerifiedState({ email: result?.email || 'Administrator', role: 'Administrator', time: new Date().toLocaleString(), handshakeId });
    }).catch(error => {
      setAlert({ type: 'error', text: error.message || 'The verification link expired. Request another link from the login screen.' });
    }).finally(() => setIsLoading(false));
  }, [onLoginSuccess]);

  const beginAdminLogin = async (firebaseUser, profile) => {
    if (!profile?.isAdmin) return false;
    const cleanEmail = String(firebaseUser.email || '').trim().toLowerCase();
    const isSuper = profile.role === 'SuperAdmin' || isBootstrapSuperAdminEmail(cleanEmail);
    // Align selected role to admin/superadmin mode
    setSelectedRole(isSuper ? 'superadmin' : 'admin');
    try {
      const handshakeResult = await createAdminLoginHandshake(cleanEmail);
      const handshakeId = typeof handshakeResult === 'string' ? handshakeResult : handshakeResult.handshakeId;
      const isExisting = Boolean(handshakeResult?.isExisting);
      const remainingMinutes = handshakeResult?.remainingMinutes || 15;
      const remainingMs = handshakeResult?.remainingMs || 15 * 60 * 1000;
      const expiresAt = handshakeResult?.expiresAt || (Date.now() + 15 * 60 * 1000);

      if (isExisting) {
        setEmailLinkSentState({ 
          email: cleanEmail, 
          handshakeId, 
          sentAt: Date.now() - (15 * 60 * 1000 - remainingMs), 
          expiresAt, 
          role: profile.role 
        });
        setResendCooldown(Math.min(60, Math.ceil(remainingMs / 1000)));
        setAlert({ 
          type: 'info', 
          text: `ℹ️ A 2-Step verification link was already sent to ${cleanEmail} and remains valid for ~${remainingMinutes} more minute${remainingMinutes === 1 ? '' : 's'}. Please check your inbox or spam folder.` 
        });
        setIsLoading(false);
        return true;
      }

      await sendAdminSignInVerificationLink(cleanEmail, handshakeId);
      setEmailLinkSentState({ email: cleanEmail, handshakeId, sentAt: Date.now(), expiresAt, role: profile.role });
      setResendCooldown(60);
      setAlert({ type: 'success', text: `🛡️ Verification link dispatched to ${cleanEmail}. Check your inbox to complete sign-in (valid for 15 minutes).` });
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Admin 2SV dispatch error:', err);
      try {
        localStorage.removeItem('hss_pending_admin_login');
        localStorage.removeItem('emailForSignIn');
        sessionStorage.removeItem('hss_auth_handshake_id');
      } catch (_) {}
      let errorMsg = 'Failed to dispatch verification link.';
      if (err.code === 'auth/unauthorized-continue-uri') {
        errorMsg = 'This URL is not authorized for verification links in Firebase Console. Please whitelist it in Authorized Domains.';
      } else if (err.code === 'auth/quota-exceeded') {
        errorMsg = 'Daily email verification quota reached. Please try again later or contact support.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setAlert({ type: 'error', text: errorMsg });
      setIsLoading(false);
      return true;
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await setPersistence(auth, keepLoggedIn ? browserLocalPersistence : browserSessionPersistence);
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const cleanEmail = String(fbUser.email || '').toLowerCase().trim();
      const displayName = fbUser.displayName || cleanEmail.split('@')[0];

      // Authoritatively resolve whether this user is an authorized Staff member
      const staffProfile = await resolveStaffRoleAndPerms(fbUser);
      const isStaff = !!staffProfile;
      const assignedRole = staffProfile ? staffProfile.role : 'Student';
      const assignedPerms = staffProfile ? (staffProfile.perms || []) : [];
      const isSuper = staffProfile?.isSuperAdmin || staffProfile?.role === 'SuperAdmin' || isBootstrapSuperAdminEmail(cleanEmail);
      const isAdmin = isSuper || staffProfile?.isAdmin || isBootstrapAdminEmail(cleanEmail) || String(staffProfile?.role || '').toLowerCase() === 'admin';
      const isTeacher = staffProfile?.isTeacher || ['teacher', 'faculty'].includes(String(staffProfile?.role || '').toLowerCase());

      // Save demographic profile using UID as document ID without erasing staff roles
      try {
        const userPayload = {
          uid: fbUser.uid,
          email: cleanEmail,
          name: displayName,
          mobile: fbUser.phoneNumber || staffProfile?.mobile || '',
          role: assignedRole,
          perms: assignedPerms,
          subject: staffProfile?.subject || staffProfile?.teachingSubject || '',
          teachingSubject: staffProfile?.teachingSubject || staffProfile?.subject || '',
          assignedSubjects: Array.isArray(staffProfile?.assignedSubjects) && staffProfile.assignedSubjects.length > 0
            ? staffProfile.assignedSubjects
            : (staffProfile?.subject ? String(staffProfile.subject).split(/[,;]+/).map(s => s.trim()).filter(Boolean) : []),
          assignedClasses: normalizeTeacherClasses(
            Array.isArray(staffProfile?.assignedClasses)
              ? staffProfile.assignedClasses
              : (staffProfile?.assignedClass ? [staffProfile.assignedClass] : [])
          ),
          classSubjectMap: staffProfile?.classSubjectMap || null,
          tierSubjects: staffProfile?.tierSubjects || null,
          isStaff,
          requestedRole: assignedRole,
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', fbUser.uid), userPayload, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore profile sync note:', fsErr);
      }

      // --- 1. TEACHER TAB ACCESS (DIRECT LOGIN, NO ADMIN 2SV) ---
      if (selectedRole === 'teacher') {
        if (!isTeacher && !isAdmin) {
          await signOut(auth).catch(() => {});
          setAlert({
            type: 'error',
            text: 'Access Denied: Unauthorized account for Faculty Portal.'
          });
          setIsLoading(false);
          return;
        }

        incrementTeacherLoginCount(cleanEmail).catch(() => {});
        const verifiedSession = await createVerifiedSession(fbUser, cleanEmail, staffProfile);
        verifiedSession.redirectPath = '/portal/teacher';
        setAlert({ type: 'success', text: `Welcome back, ${verifiedSession.user.name}! Redirecting to Teacher Portal...` });
        onLoginSuccess(verifiedSession, keepLoggedIn);
        return;
      }

      // --- 2. ADMIN TAB / ROLES ---
      if (selectedRole === 'admin' || selectedRole === 'superadmin') {
        if (!isAdmin || (selectedRole === 'superadmin' && !isSuper)) {
          await signOut(auth).catch(() => {});
          setAlert({
            type: 'error',
            text: 'Access Denied: You do not have administrator privileges.'
          });
          setIsLoading(false);
          return;
        }

        // Direct entry for all authorized administrative accounts signing in with Google OAuth
        // (Google OAuth already cryptographically verifies identity and active browser session)
        const verifiedSession = await createVerifiedSession(fbUser, cleanEmail, staffProfile);
        verifiedSession.redirectPath = '/portal/admin';
        const roleLabel = isSuperAdminEmail(cleanEmail) ? 'Super Admin' : (verifiedSession.user.name || 'Administrator');
        setAlert({ type: 'success', text: `Welcome back, ${roleLabel}! Unlocking Admin Portal...` });
        onLoginSuccess(verifiedSession, keepLoggedIn);
        return;
      }

      // --- 3. STUDENT TAB (DEFAULT) ---
      const verifiedSession = await createVerifiedSession(fbUser, cleanEmail, staffProfile);
      if (isAdmin) {
        verifiedSession.redirectPath = '/portal/admin';
        setAlert({ type: 'success', text: `Welcome back, ${verifiedSession.user.name}! Redirecting to Admin Portal...` });
      } else {
        setAlert({ type: 'success', text: 'Login successful! Redirecting to Portal...' });
      }
      onLoginSuccess(verifiedSession, keepLoggedIn);
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setAlert({
          type: 'error',
          text: 'An account with this email address already exists. Please sign in with your email and password first, or reset your password to link your Google account.'
        });
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setAlert({ type: 'error', text: err.message || 'Google Sign-In failed. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendAdminLink = async () => {
    if (!emailLinkSentState?.email || resendCooldown > 0) return;
    setIsLoading(true);
    try {
      const cleanEmail = emailLinkSentState.email;
      const handshakeResult = await createAdminLoginHandshake(cleanEmail);
      const handshakeId = typeof handshakeResult === 'string' ? handshakeResult : handshakeResult.handshakeId;
      const isExisting = Boolean(handshakeResult?.isExisting);
      const remainingMinutes = handshakeResult?.remainingMinutes || 15;
      const remainingMs = handshakeResult?.remainingMs || 15 * 60 * 1000;
      const expiresAt = handshakeResult?.expiresAt || (Date.now() + 15 * 60 * 1000);

      if (isExisting) {
        setResendCooldown(Math.min(60, Math.ceil(remainingMs / 1000)));
        setAlert({ 
          type: 'info', 
          text: `ℹ️ A verification link for ${cleanEmail} is already active and valid for ~${remainingMinutes} more minute${remainingMinutes === 1 ? '' : 's'}. Check your email inbox or spam folder.` 
        });
        return;
      }

      await sendAdminSignInVerificationLink(cleanEmail, handshakeId);
      setEmailLinkSentState(prev => ({ ...(prev || {}), handshakeId, sentAt: Date.now(), expiresAt }));
      setResendCooldown(60);
      setAlert({ type: 'success', text: `Fresh 2-step verification link sent to ${cleanEmail}! (Valid for 15 minutes)` });
    } catch (err) {
      console.error('Resend verification link error:', err);
      if (err.code === 'auth/quota-exceeded') {
        setAlert({ type: 'error', text: 'Email dispatch quota exceeded. Please try again later or contact administrator.' });
      } else {
        setAlert({ type: 'error', text: 'Failed to resend link. Please try again in a moment.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel2Step = async () => {
    try {
      if (emailLinkSentState?.handshakeId) {
        await consumeAdminLoginHandshake(emailLinkSentState.handshakeId).catch(() => {});
      }
      localStorage.removeItem('emailForSignIn');
      localStorage.removeItem('hss_pending_admin_login');
      localStorage.removeItem('hss_admin_auth_approved');
      sessionStorage.removeItem('hss_auth_handshake_id');
      sessionStorage.removeItem('hss_session_terminated');
      await signOut(auth).catch(() => {});
    } catch (_) {}
    setEmailLinkSentState(null);
    setAlert(null);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setAlert({ type: 'error', text: 'Please enter both email and password.' });
      return;
    }

    if (!captchaToken) {
      setAlert({ type: 'error', text: 'Please complete the security verification (I am human) before signing in.' });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Authenticate credentials against Firebase Auth
      await setPersistence(auth, keepLoggedIn ? browserLocalPersistence : browserSessionPersistence);
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      
      // 2. Resolve account profile from Firestore (configured strictly by Super Admin)
      const staffProfile = await resolveStaffRoleAndPerms(cleanEmail);
      const isSuper = staffProfile?.isSuperAdmin || staffProfile?.role === 'SuperAdmin' || isBootstrapSuperAdminEmail(cleanEmail);
      const isAdmin = isSuper || staffProfile?.isAdmin || isBootstrapAdminEmail(cleanEmail) || String(staffProfile?.role || '').toLowerCase() === 'admin';
      const isTeacher = staffProfile?.isTeacher || ['teacher', 'faculty'].includes(String(staffProfile?.role || '').toLowerCase()) || Boolean(staffProfile?.subject || staffProfile?.teachingSubject);

      // 3. STRICT TAB & ROLE ACCESS CONTROL

      // --- ADMIN TAB ACCESS GUARD (STRICT: Block non-admins without triggering 2SV) ---
      if (selectedRole === 'admin' || selectedRole === 'superadmin') {
        if (!isAdmin || (selectedRole === 'superadmin' && !isSuper)) {
          await signOut(auth).catch(() => {});
          setAlert({
            type: 'error',
            text: 'Access Denied: You do not have administrator privileges.'
          });
          setIsLoading(false);
          return;
        }

        // Check if 2-Step Verification is required for admin email/password login
        const siteSettings = await loadSiteSettings().catch(() => null);
        const require2Step = siteSettings?.enableAdmin2StepVerification ?? true;

        if (require2Step) {
          // Admin 2-Step Verification Interception
          if (await beginAdminLogin(userCred.user, staffProfile)) return;
        }

        // If 2SV is bypassed or not active, redirect directly
        const verifiedSession = await createVerifiedSession(userCred.user, cleanEmail, staffProfile);
        verifiedSession.redirectPath = '/portal/admin';
        setAlert({ type: 'success', text: 'Login successful! Redirecting to Admin Portal...' });
        onLoginSuccess(verifiedSession, keepLoggedIn);
        return;
      }

      // --- TEACHER TAB ACCESS ---
      if (selectedRole === 'teacher') {
        if (!isTeacher && !isAdmin) {
          await signOut(auth).catch(() => {});
          setAlert({
            type: 'error',
            text: 'Access Denied: Unauthorized account for Faculty Portal.'
          });
          setIsLoading(false);
          return;
        }

        // Direct Teacher Login (Non-blocking login count update, immediate redirect)
        incrementTeacherLoginCount(cleanEmail).catch(() => {});
        const verifiedSession = await createVerifiedSession(userCred.user, cleanEmail, staffProfile);
        verifiedSession.redirectPath = '/portal/teacher';
        setAlert({ type: 'success', text: `Welcome back, ${verifiedSession.user.name}! Redirecting to Teacher Portal...` });
        onLoginSuccess(verifiedSession, keepLoggedIn);
        return;
      }

      // --- AUTO-RECOGNIZE TEACHER ACCOUNT (On Student Tab) ---
      if (isTeacher && selectedRole === 'student') {
        incrementTeacherLoginCount(cleanEmail).catch(() => {});
        const verifiedSession = await createVerifiedSession(userCred.user, cleanEmail, staffProfile);
        verifiedSession.redirectPath = '/portal/teacher';
        setAlert({ 
          type: 'success', 
          text: `Welcome back, ${verifiedSession.user.name}! Redirecting to Teacher Portal...` 
        });
        onLoginSuccess(verifiedSession, keepLoggedIn);
        return;
      }

      // --- STUDENT TAB ACCESS (OR DEFAULT) ---
      const verifiedSession = await createVerifiedSession(userCred.user, cleanEmail, staffProfile);
      setAlert({ type: 'success', text: 'Login successful! Redirecting to Student Portal...' });
      onLoginSuccess(verifiedSession, keepLoggedIn);

    } catch (err) {
      console.error('Login error:', err);
      let isGoogleOnly = false;

      // 1. Check sign in methods registered in Firebase Auth
      try {
        const methods = await fetchSignInMethodsForEmail(auth, cleanEmail);
        if (Array.isArray(methods) && methods.length > 0) {
          if (methods.includes('google.com') && !methods.includes('password')) {
            isGoogleOnly = true;
          }
        }
      } catch (mErr) {
        console.warn('Sign-in methods query note:', mErr);
      }

      // 2. Secondary fallback check in Firestore users collection
      if (!isGoogleOnly) {
        try {
          const userSnap = await getDoc(doc(db, 'users', cleanEmail));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.authProvider === 'google.com' || (Array.isArray(data.authProviders) && data.authProviders.includes('google.com') && !data.authProviders.includes('password'))) {
              isGoogleOnly = true;
            }
          }
        } catch (_) {}
      }

      if (isGoogleOnly) {
        setAlert({
          type: 'error',
          isGooglePrompt: true,
          email: cleanEmail,
          text: 'This account was registered using Google Sign-In and does not have a password set yet. Please click "Sign in with Google" below, or use "Reset Password" to set a password for email login.'
        });
      } else if (err.code === 'auth/quota-exceeded') {
        setAlert({ type: 'error', text: 'Service temporarily unavailable due to high demand. Please try again after some time.' });
      } else if (err.code === 'auth/too-many-requests') {
        setAlert({ type: 'error', text: 'Too many failed login attempts. Please try again later or reset your password.' });
      } else if (err.code === 'auth/network-request-failed') {
        setAlert({ type: 'error', text: 'Network error. Please check your internet connection.' });
      } else if (err.code === 'permission-denied' || (err.message && err.message.includes('insufficient permissions'))) {
        setAlert({ type: 'error', text: 'A system configuration issue occurred. Please contact the administrator.' });
      } else if (err.message && err.message.includes('portal')) {
        setAlert({ type: 'error', text: err.message });
      } else {
        setAlert({ type: 'error', text: 'Invalid email or password. Please check your credentials or reset your password.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Role preview metadata for left hero card
  const ROLE_DETAILS = {
    student: {
      badge: 'Student Portal Desk',
      title: 'Online Admissions & Academic Dashboard',
      desc: 'Access your application status, download examination roll slips, verify fee receipts, and track attendance.',
      features: ['Admission Status & Roll Slips', 'Digital Fee Receipts & History', 'Practicals & Marks Evaluation'],
      color: 'teal',
      icon: GraduationCap,
    },
    teacher: {
      badge: 'Faculty Workspace Desk',
      title: 'Staff & Practical Evaluation Portal',
      desc: 'Record daily class attendance, upload awards and practical marks, and manage subject circulars.',
      features: ['Class Attendance Management', 'Practicals & Awards Evaluation', 'Student Academic Registers'],
      color: 'emerald',
      icon: UserCheck,
    },
    admin: {
      badge: 'Admin Control Center',
      title: 'Master School Management Suite',
      desc: 'Manage student registers, roll number allocations, subject definitions, and automated email dispatches.',
      features: ['Master Register & Admissions', 'Roll No Auto-Assigner Suite', 'Fund Accounts & Automations'],
      color: 'purple',
      icon: Lock,
    },
    superadmin: {
      badge: 'SuperAdmin Access Mode',
      title: 'Executive System Control',
      desc: 'Full administrative access across all student, faculty, financial, and monitoring modules.',
      features: ['System-wide Override Access', 'Administrative Module Management', 'Security & System Controls'],
      color: 'amber',
      icon: Crown,
    },
  };

  const activeRoleInfo = ROLE_DETAILS[selectedRole] || ROLE_DETAILS.student;
  const RoleIcon = activeRoleInfo.icon;

  return (
    <div className="portal-auth-page w-full min-h-[calc(100vh-var(--site-header-height,64px))] flex items-center justify-center py-6 px-3 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      <SEO
        title="Student & Staff Login Portal | HSS Shangus"
        description="Official Govt HSS Shangus Online Portal. Access admissions, roll slips, attendance tracking, and faculty utilities."
        path="/portal/login"
      />

      {/* Ambient Glowing Background Orbs */}
      <div className={`absolute top-1/4 -left-20 w-72 sm:w-96 h-72 sm:h-96 blur-3xl rounded-full pointer-events-none transition-all duration-700 ${
        isSuperAdmin ? 'bg-purple-500/15' : selectedRole === 'teacher' ? 'bg-emerald-500/15' : 'bg-teal-500/15'
      }`} />
      <div className={`absolute bottom-10 -right-20 w-72 sm:w-96 h-72 sm:h-96 blur-3xl rounded-full pointer-events-none transition-all duration-700 ${
        isSuperAdmin ? 'bg-indigo-500/15' : 'bg-cyan-500/15'
      }`} />

      {/* Responsive Container — Split-screen on Large (lg+), Compact Card on Mobile/Tablet */}
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-center relative z-10">

        {/* LEFT COLUMN: HERO SHOWCASE (Visible on lg+ screens, stacked cleanly on tablet/mobile) */}
        <div className="lg:col-span-6 space-y-3.5 text-left hidden md:block px-2 sm:px-3">
          
          {/* Institution Header Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-slate-900/5 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-2xs backdrop-blur-md">
            <School size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Govt. Higher Secondary School Shangus</span>
          </div>

          {/* Main Hero Title */}
          <div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-tight uppercase">
              <span className="moving-gradient-subtle">Digital Student & Staff</span>{' '}
              <span className="moving-gradient-text">Portal</span>
            </div>
            <p className="text-xs sm:text-[13px] font-bold text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed max-w-lg">
              Official unified portal for students, faculty, and school administration. Access admissions, roll slips, attendance, and exam management.
            </p>
          </div>

          {/* Dynamic Active Role Feature Card */}
          <div className="rounded-2xl p-4 border shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/80 dark:border-slate-800/80 space-y-3 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${
                  isSuperAdmin ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' 
                  : selectedRole === 'teacher' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                  : 'bg-teal-500/10 text-teal-600 border border-teal-500/20'
                }`}>
                  <RoleIcon size={18} />
                </div>
                <div>
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                    {activeRoleInfo.badge}
                  </span>
                  <h3 className="text-[13px] font-black text-slate-900 dark:text-white">
                    {activeRoleInfo.title}
                  </h3>
                </div>
              </div>

              <span className="flex items-center gap-1 text-[10.5px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 size={11} /> Active
              </span>
            </div>

            <p className="text-[11.5px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
              {activeRoleInfo.desc}
            </p>

            <div className="pt-1 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
              {activeRoleInfo.features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick System Stats Footer Bar */}
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-1 px-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-teal-600 dark:text-teal-400" />
              256-Bit Encrypted Session
            </span>
            <span className="flex items-center gap-1.5">
              <Award size={13} className="text-indigo-600 dark:text-indigo-400" />
              Session 2025-26
            </span>
          </div>

        </div>

        {/* RIGHT COLUMN: MAIN LOGIN GLASS CARD (Fully Responsive 100% width on mobile, 6-col on lg) */}
        <div className="lg:col-span-6 w-full max-w-[420px] mx-auto lg:max-w-none">
          
          <div className={`rounded-2xl sm:rounded-3xl p-3.5 xs:p-4 sm:p-5.5 border shadow-lg sm:shadow-xl transition-all duration-300 relative overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl ${
            activeTheme.cardBorder
          }`}>

            {/* Loading blur overlay */}
            {isLoading && (
              <div 
                className="absolute inset-0 z-50 rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center p-4 animate-fadeIn"
                style={{ backgroundColor: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
              >
                <ModernLoader
                  moduleKey={isSuperAdmin ? 'admin' : 'auth'}
                  text="Signing in…"
                  subtext="Please wait."
                  className="py-4"
                />
              </div>
            )}

            {/* Card Header: School Crest + Title + SuperAdmin Quick Toggle */}
            <div className="relative z-10 space-y-1.5 sm:space-y-2 mb-2 sm:mb-2.5">
              
              {/* Crest Logo */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center p-1 shadow-2xs">
                    <img src="/logo512.png" alt="HSS Shangus Crest" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider text-slate-400 block leading-tight">
                      HSS Shangus Portal
                    </span>
                    <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                      Sign In
                    </h1>
                  </div>
                </div>

                {/* Cryptic SuperAdmin Mode Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (emailLinkSentState) handleCancel2Step();
                    setSelectedRole(isSuperAdmin ? 'admin' : 'superadmin');
                    setCaptchaToken(null);
                  }}
                  title={isSuperAdmin ? 'Switch to Standard Admin' : 'System Mode'}
                  className="group relative flex-shrink-0 p-1.5 rounded-xl opacity-30 hover:opacity-100 transition-opacity cursor-pointer text-slate-400 hover:text-purple-500"
                >
                  <Sparkles size={13} className={isSuperAdmin ? 'text-purple-500 opacity-100' : ''} />
                  {isSuperAdmin && (
                    <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  )}
                </button>
              </div>

              {isSuperAdmin && (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 w-full justify-center animate-fadeIn">
                  <ShieldCheck size={12} /> SuperAdmin Access Mode Active
                </div>
              )}
            </div>

            {/* Segmented Control Role Selector Tabs (3 Tabs: Student, Teacher, Admin) */}
            <div className="grid grid-cols-3 p-0.5 rounded-xl border text-[11px] sm:text-xs font-black relative z-10 bg-slate-100/90 dark:bg-slate-950/90 border-slate-200 dark:border-slate-800 mb-2">
              <button
                type="button"
                onClick={() => {
                  if (emailLinkSentState) handleCancel2Step();
                  setSelectedRole('student');
                  setCaptchaToken(null);
                }}
                className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 cursor-pointer ${
                  selectedRole === 'student'
                    ? ROLE_THEMES.student.tabActive
                    : `text-slate-600 dark:text-slate-400 ${ROLE_THEMES.student.tabHover} font-extrabold`
                }`}
              >
                <GraduationCap size={13} className="shrink-0" /> 
                <span className="truncate text-[11px] sm:text-xs">Student</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (emailLinkSentState) handleCancel2Step();
                  setSelectedRole('teacher');
                  setCaptchaToken(null);
                }}
                className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 cursor-pointer ${
                  selectedRole === 'teacher'
                    ? ROLE_THEMES.teacher.tabActive
                    : `text-slate-600 dark:text-slate-400 ${ROLE_THEMES.teacher.tabHover} font-extrabold`
                }`}
              >
                <UserCheck size={13} className="shrink-0" /> 
                <span className="truncate text-[11px] sm:text-xs">Teacher</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (emailLinkSentState) handleCancel2Step();
                  setSelectedRole(isSuperAdmin ? 'superadmin' : 'admin');
                  setCaptchaToken(null);
                }}
                className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 cursor-pointer ${
                  selectedRole === 'admin' || isSuperAdmin
                    ? (isSuperAdmin ? ROLE_THEMES.superadmin.tabActive : ROLE_THEMES.admin.tabActive)
                    : `text-slate-600 dark:text-slate-400 ${isSuperAdmin ? ROLE_THEMES.superadmin.tabHover : ROLE_THEMES.admin.tabHover} font-extrabold`
                }`}
              >
                {isSuperAdmin ? (
                  <>
                    <ShieldCheck size={13} className="shrink-0" />
                    <span className="truncate text-[11px] sm:text-xs">SuperAdmin</span>
                  </>
                ) : (
                  <>
                    <Lock size={13} className="shrink-0" /> 
                    <span className="truncate text-[11px] sm:text-xs">Admin</span>
                  </>
                )}
              </button>
            </div>

            {/* Compact Teacher Account Pre-detection Badge */}
            {selectedRole !== 'teacher' && isLikelyTeacherEmail(email) && (
              <div className="mb-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-[10.5px] font-bold flex items-center justify-between gap-1.5 animate-fadeIn relative z-10 shadow-2xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate">Teacher account detected</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('teacher');
                    setCaptchaToken(null);
                  }}
                  className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] tracking-wide transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1"
                >
                  <span>Switch to Teacher</span>
                  <ArrowRight size={10} />
                </button>
              </div>
            )}

            {/* Alert Banner (Suppressed during clean waiting / confirmed states unless error) */}
            {alert && !emailLinkSentState && !window2VerifiedState && (
              <div className={`p-3.5 rounded-2xl text-xs font-bold flex flex-col gap-2.5 mb-4 animate-fadeIn relative z-10 ${
                alert.type === 'error' 
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400' 
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              }`}>
                <div className="flex items-start gap-2.5">
                  {alert.type === 'error' ? <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> : <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />}
                  <span>{alert.text}</span>
                </div>

                {alert.isGooglePrompt && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-500/20">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-black text-[11px] shadow-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>Sign in with Google</span>
                    </button>
                    <Link
                      to={`/portal/forgot-password?email=${encodeURIComponent(alert.email || email)}`}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px] shadow-xs flex items-center gap-1"
                    >
                      <KeyRound size={12} />
                      <span>Reset Password</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* 2-Step Verification Confirmation View (Window 2) vs Waiting View (Window 1) vs Main Login Form */}
            {window2VerifiedState ? (
              /* == == == == == == == == WINDOW 2: VERIFIED LOGIN DETAILS VIEW == == == == == == == == */
              <div className="space-y-5 relative z-10 text-center animate-fadeIn py-3">
                {/* Animated Success Badge */}
                <div className="relative mx-auto w-20 h-20">
                  {/* Outer rotating ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-300/50 dark:border-emerald-500/30 animate-spin" style={{ animationDuration: '12s' }}></div>
                  {/* Inner glow ring */}
                  <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-emerald-400/20 via-teal-400/10 to-emerald-500/20 dark:from-emerald-500/15 dark:via-teal-500/10 dark:to-emerald-600/15 animate-pulse" style={{ animationDuration: '2s' }}></div>
                  {/* Center icon */}
                  <div className="absolute inset-3 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <ShieldCheck size={26} className="text-white drop-shadow-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      Verified & Authorized
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Identity Confirmed
                  </h2>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                    Your secure sign-in has been authenticated successfully.
                  </p>
                </div>

                {/* Verification Details Card */}
                <div className="rounded-2xl bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/80 dark:to-slate-800/40 border border-slate-200/80 dark:border-slate-700/50 p-4 text-left text-xs space-y-0 overflow-hidden relative">
                  {/* Subtle top accent */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400"></div>
                  
                  <div className="flex items-center justify-between py-2.5 border-b border-slate-200/60 dark:border-slate-700/40">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                      <Mail size={12} /> Account
                    </span>
                    <span className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200">{window2VerifiedState.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 border-b border-slate-200/60 dark:border-slate-700/40">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                      <Award size={12} /> Role
                    </span>
                    <span className="font-black text-[11px] text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400">{window2VerifiedState.role || 'Staff'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 border-b border-slate-200/60 dark:border-slate-700/40">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                      <Compass size={12} /> Verified At
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">{window2VerifiedState.time || 'Just now'}</span>
                  </div>
                  <div className="flex items-start gap-2 pt-3 text-[11px] font-medium text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                    <Sparkles size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>Your main login window has auto-detected this verification and loaded your {window2VerifiedState.role === 'Teacher' ? 'Teacher Workspace' : 'Admin Dashboard'}.</span>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5 font-black text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 size={16} />
                      <span>Login Access Granted</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-normal">
                      Your original login window has been authorized and is loading the {window2VerifiedState.role === 'Teacher' ? 'Teacher Workspace' : 'Admin Dashboard'}.
                    </p>
                  </div>

                  {/* Primary Action: Close Tab */}
                  <button
                    type="button"
                    onClick={() => {
                      setCloseTabNote(true);
                      window.close();
                    }}
                    className="w-full py-2.5 rounded-xl font-black text-xs bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white cursor-pointer transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <X size={15} />
                    <span>Close This Window</span>
                  </button>

                  {closeTabNote ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800 text-center animate-fadeIn">
                      ℹ️ You can now safely close this browser tab (or press Ctrl+W / tap ✕).
                    </p>
                  ) : (
                    <p className="text-[10.5px] text-slate-400 dark:text-slate-500 m-0 text-center">
                      You can safely close this browser window or tab.
                    </p>
                  )}

                  {/* Optional Fallback Link if original window was lost */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        isEmailVerificationTabRef.current = false;
                        localStorage.removeItem('hss_pending_admin_login');
                        localStorage.removeItem('emailForSignIn');
                        sessionStorage.removeItem('hss_auth_handshake_id');
                        if (window2VerifiedState?.verifiedSession) {
                          onLoginSuccess(window2VerifiedState.verifiedSession, true);
                        }
                        navigate(window2VerifiedState?.redirectPath || '/portal/admin', { replace: true });
                      }}
                      className="text-[10.5px] font-bold text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer underline transition-colors"
                    >
                      Need to access the dashboard on this device instead? Click here
                    </button>
                  </div>
                </div>
              </div>
            ) : emailLinkSentState ? (
              /* == == == == == == == == WINDOW 1: PREMIUM 2-STEP WAITING VIEW == == == == == == == == */
              <div className="space-y-5 relative z-10 text-center animate-fadeIn py-3">
                {/* Animated Shield with Pulse Ring */}
                <div className="relative mx-auto w-20 h-20">
                  {/* Outer pulsing ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-amber-300/40 dark:border-amber-500/20 animate-ping" style={{ animationDuration: '3s' }}></div>
                  {/* Middle rotating dashed ring */}
                  <div className="absolute inset-1 rounded-full border-2 border-dashed border-amber-400/30 dark:border-amber-500/20 animate-spin" style={{ animationDuration: '15s' }}></div>
                  {/* Glow background */}
                  <div className="absolute inset-2.5 rounded-full bg-gradient-to-br from-amber-400/15 via-orange-400/10 to-amber-500/15 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-amber-600/10"></div>
                  {/* Center icon */}
                  <div className="absolute inset-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <ShieldAlert size={22} className="text-white drop-shadow-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                      Verification Required
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Check Your Inbox
                  </h2>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                    A secure sign-in link has been sent to
                  </p>
                </div>

                {/* Email Card */}
                <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/70 dark:border-amber-800/40 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Mail size={16} className="text-white" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">{emailLinkSentState.email}</p>
                    <p className="text-[10px] font-semibold text-amber-600/80 dark:text-amber-400/70">Click the link in the email to continue</p>
                  </div>
                </div>

                {/* Live Status Indicator */}
                <div className="flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Listening for verification in real-time</span>
                </div>

                {/* 1-Click Direct Sign-in as Teacher if the account has Teacher privileges */}
                {isLikelyTeacherEmail(emailLinkSentState.email) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          const cleanEmail = String(emailLinkSentState.email).trim().toLowerCase();
                          const staffProfile = await resolveStaffRoleAndPerms(cleanEmail);
                          incrementTeacherLoginCount(cleanEmail).catch(() => {});
                          const verifiedSession = await createVerifiedSession(auth.currentUser, cleanEmail, staffProfile);
                          verifiedSession.redirectPath = '/portal/teacher';
                          handleCancel2Step();
                          setAlert({ type: 'success', text: `Welcome back, ${verifiedSession.user.name}! Redirecting to Teacher Portal...` });
                          onLoginSuccess(verifiedSession, keepLoggedIn);
                        } catch (err) {
                          setAlert({ type: 'error', text: err.message || 'Direct teacher login failed.' });
                          setIsLoading(false);
                        }
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                    >
                      <UserCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Sign In Directly as Teacher (No Email Link Needed)</span>
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 pt-0.5 text-xs">
                  <button
                    type="button"
                    onClick={handleResendAdminLink}
                    disabled={resendCooldown > 0 || isLoading}
                    className="font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend link'}
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={handleCancel2Step}
                    className="font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors"
                  >
                    Back to login
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* == == == == == == == == MAIN LOGIN FORM == == == == == == == == */}
                <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-2.5 relative z-10">
                
                {/* Email Input */}
                <div className="space-y-0.5 sm:space-y-1 text-left">
                  <label htmlFor="login-email" className="block text-[10.5px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                    Email Address <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative group">
                    <Mail size={13} className={`sm:w-3.5 sm:h-3.5 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 ${activeTheme.iconFocus} transition-colors pointer-events-none`} />
                    <input
                      id="login-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={`w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-[13px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none ${activeTheme.inputFocus} transition-all duration-150`}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-0.5 sm:space-y-1 text-left">
                  <label htmlFor="login-password" className="block text-[10.5px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                    Password <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative group">
                    <KeyRound size={13} className={`sm:w-3.5 sm:h-3.5 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 ${activeTheme.iconFocus} transition-colors pointer-events-none`} />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className={`w-full pl-8 sm:pl-9 pr-8 sm:pr-9 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-[13px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none ${activeTheme.inputFocus} transition-all duration-150`}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                {/* Options Row: Keep Logged In + Forgot Password */}
                <div className="flex items-center justify-between text-[10.5px] sm:text-[11.5px] font-bold pt-0">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 select-none">
                    <input
                      type="checkbox"
                      checked={keepLoggedIn}
                      onChange={(e) => setKeepLoggedIn(e.target.checked)}
                      className={`rounded border-slate-300 ${activeTheme.checkbox} cursor-pointer w-3.5 h-3.5`}
                    />
                    <span>Keep me logged in</span>
                  </label>

                  <Link to="/portal/forgot-password" className={`${activeTheme.link} font-bold`}>
                    Forgot Password?
                  </Link>
                </div>

                {/* Modern Zero-Dependency Security Verification Check */}
                <ModernCaptcha
                  onVerify={(token) => setCaptchaToken(token)}
                  isVerified={Boolean(captchaToken)}
                  onReset={() => setCaptchaToken(null)}
                />

                {/* Main Submit CTA Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-xs sm:text-[13px] text-white shadow-md transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.99] mt-0.5 ${activeTheme.btnGradient}`}
                >
                  {isLoading ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <>
                      <span>{activeTheme.btnLabel}</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </form>

              {/* Social Google OAuth Button */}
              <div className="relative z-10 pt-1.5 sm:pt-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-[13px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>

              {/* Registration Footer Link */}
              <div className="text-center text-[10.5px] sm:text-[11px] relative z-10 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                <span className="text-slate-500 font-medium">Don't have an account? </span>
                <Link to="/portal/register" className="text-teal-600 dark:text-teal-400 font-bold hover:underline inline-flex items-center gap-1">
                  Create New Account <ChevronRight size={11} className="sm:w-3 sm:h-3" />
                </Link>
              </div>
            </>
          )}

          </div>
        </div>

      </div>
    </div>
  );
}
