import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useLocation, Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Eye, EyeOff, Lock, User, GraduationCap, UserCheck,
  AlertCircle, CheckCircle, ArrowRight, RefreshCw, Crown, Sparkles,
  KeyRound, Mail, School, Award, CheckCircle2, ChevronRight, Compass,
  Send, ExternalLink, ArrowLeft, ShieldAlert, X, Globe, FileText,
  Layers, Search, Building2, QrCode, BookOpen, ChevronDown, ChevronUp, Check
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
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import {
  requireVerifiedAdminSession,
  resolveStaffRoleAndPerms,
  createAdminLoginHandshake,
  approveAdminLoginHandshake,
  consumeAdminLoginHandshake,
  incrementTeacherLoginCount,
  recordTeacher2StepVerification,
  isBootstrapSuperAdminEmail,
  isBootstrapAdminEmail,
  isSuperAdminEmail,
  FALLBACK_STAFF_PROFILES
} from '../services/staffAuthService';
import {
  ROLES,
  getStrictCanonicalRole,
  enforceStrictRoleAttributes,
  isStandardAdminEmail
} from '../utils/authRoles';
import { sessionManager } from '../services/sessionManager';
import ModernCaptcha from '../components/ModernCaptcha';
import { normalizeTeacherClasses } from '../utils/practicalsSettingsManager';
import { loadSiteSettings } from '../utils/settingsLoader';

// Helper to quickly check if an email belongs strictly to a teacher/faculty
const isLikelyTeacherEmail = (rawEmail) => {
  const clean = String(rawEmail || '').trim().toLowerCase();
  if (!clean || !clean.includes('@')) return false;
  return getStrictCanonicalRole(clean) === ROLES.TEACHER;
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

  // If the user arrives with a password reset or auth action link (e.g. from Firebase email or continueUrl),
  // forward immediately to the dedicated AuthActionPage so it is handled correctly rather than as a 2SV login!
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
    const mode = searchParams.get('mode') || hashParams.get('mode');
    const oobCode = searchParams.get('oobCode') || hashParams.get('oobCode');
    if (oobCode && (mode === 'resetPassword' || mode === 'verifyEmail' || mode === 'recoverEmail')) {
      navigate(`/portal/auth/action${window.location.search}${window.location.hash}`, { replace: true });
    }
  }, [navigate]);

  // Window 2: Successful verification confirmation state (when link was clicked in this tab)
  const [window2VerifiedState, setWindow2VerifiedState] = useState(null);
  const [closeTabNote, setCloseTabNote] = useState(false);

  // Check if current URL parameters indicate a dedicated Auth Action (e.g. password reset or email verification)
  const isAuthActionUrl = (() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
      const mode = searchParams.get('mode') || hashParams.get('mode');
      return mode === 'resetPassword' || mode === 'verifyEmail' || mode === 'recoverEmail';
    } catch (_) {
      return false;
    }
  })();

  // Permanent flag for this tab: if opened via verification link, NEVER redirect to dashboard
  const isEmailVerificationTabRef = useRef(
    !isAuthActionUrl && (
      window.location.hash.includes('staff_challenge=')
    )
  );

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
      return;
    }

    // Check if another tab is already authenticated on this device
    const isExplicitLogout = sessionStorage.getItem('hss_explicit_logout') === 'true' || localStorage.getItem('hss_explicit_logout') === 'true';
    if (!isExplicitLogout && sessionManager.isLoggedIn()) {
      const activeSession = sessionManager.getSession();
      if (activeSession?.user?.role) {
        const roleKey = String(activeSession.user.role).toLowerCase().trim();
        const dest =
          roleKey === 'student' ? '/portal/student'
          : (roleKey === 'teacher' || roleKey === 'faculty') ? '/portal/teacher'
          : '/portal/admin';
        navigate(dest, { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, window2VerifiedState, emailLinkSentState]);

  // Real-time cross-tab login synchronization (e.g. if Tab 2 is open on LoginPage and Tab 1 logs in)
  useEffect(() => {
    if (isEmailVerificationTabRef.current) return;

    let bc = null;
    try {
      bc = new BroadcastChannel('hss_portal_auth_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'LOGIN' && event.data.user) {
          const u = event.data.user;
          const roleKey = String(u.role).toLowerCase().trim();
          const dest =
            roleKey === 'student' ? '/portal/student'
            : (roleKey === 'teacher' || roleKey === 'faculty') ? '/portal/teacher'
            : '/portal/admin';
          navigate(dest, { replace: true });
        }
      };
    } catch (_) {}

    return () => {
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
    };
  }, [navigate]);

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
    // Resolve role from Firestore permissions & users collection & bootstrap (force fresh on login)
    const staffProfile = cachedStaffProfile || await resolveStaffRoleAndPerms(emailLower, true);
    const strictRole = getStrictCanonicalRole(emailLower, staffProfile);

    const siteSettings = await loadSiteSettings().catch(() => null);
    if (siteSettings?.enableAdmin2StepVerification && (strictRole === ROLES.SUPER_ADMIN || strictRole === ROLES.STANDARD_ADMIN)) {
      await requireVerifiedAdminSession(activeUser);
    }

    const isSuper = strictRole === ROLES.SUPER_ADMIN;
    const isTeacher = strictRole === ROLES.TEACHER;

    const perms = isSuper
      ? ['*']
      : (Array.isArray(staffProfile?.perms) && staffProfile.perms.length > 0)
        ? staffProfile.perms
        : (Array.isArray(claims.permissions) && claims.permissions.length > 0)
          ? claims.permissions
          : (strictRole === ROLES.STANDARD_ADMIN ? ['reports'] : (isTeacher ? ['attendanceMgmt', 'practicals'] : []));

    const sessionId = sessionManager.generateSessionId();
    sessionManager.setSessionId(sessionId);

    const cleanClasses = isTeacher
      ? normalizeTeacherClasses(
          Array.isArray(staffProfile?.assignedClasses)
            ? staffProfile.assignedClasses
            : (staffProfile?.assignedClass ? [staffProfile.assignedClass] : [])
        )
      : [];
    const cleanSubjects = isTeacher
      ? (Array.isArray(staffProfile?.assignedSubjects) && staffProfile.assignedSubjects.length > 0
          ? staffProfile.assignedSubjects
          : (staffProfile?.subject ? String(staffProfile.subject).split(/[,;]+/).map(s => s.trim()).filter(Boolean) : []))
      : [];

    const rawUser = {
      email: emailLower,
      name: staffProfile?.name || activeUser?.displayName || emailLower.split('@')[0],
      role: strictRole,
      perms,
      subject: isTeacher ? (cleanSubjects.join(', ') || staffProfile?.subject || staffProfile?.teachingSubject || '') : '',
      teachingSubject: isTeacher ? (cleanSubjects.join(', ') || staffProfile?.teachingSubject || staffProfile?.subject || '') : '',
      assignedSubjects: cleanSubjects,
      assignedClasses: cleanClasses,
      classSubjectMap: isTeacher ? (staffProfile?.classSubjectMap || null) : null,
      tierSubjects: isTeacher ? (staffProfile?.tierSubjects || null) : null,
      mobile: staffProfile?.mobile || '',
      photoURL: activeUser?.photoURL || null,
      uid: activeUser?.uid || 'admin_handshake_auth',
    };

    const resolvedUser = enforceStrictRoleAttributes(rawUser);

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

        localStorage.removeItem('emailForSignIn');
        localStorage.removeItem('hss_pending_admin_login');
        localStorage.removeItem('hss_admin_auth_approved');
        setEmailLinkSentState(null);

        setTimeout(() => {
          onLoginSuccess(verifiedSession, true);
        }, 400);
      } catch (err) {
        console.error('Real-time handshake unlock error:', err);
        setAlert({
          type: 'error',
          text: 'Verified handshake received, but session resolution failed. Please refresh or sign in.'
        });
      }
    };

    // Server-managed challenges are approved by writing an admin session bound
    // to this exact Firebase UID and sign-in auth_time. Do not trust browser
    // storage, BroadcastChannel messages, or a client-readable handshake.
    if (emailLinkSentState.serverManaged) {
      const expectedUid = emailLinkSentState.uid || auth.currentUser?.uid;
      const expectedAuthTime = Number(emailLinkSentState.authTime || 0);
      if (!expectedUid || !expectedAuthTime) return undefined;
      return onSnapshot(doc(db, 'adminSessions', expectedUid), (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const expiresAt = data?.expiresAt?.toMillis?.() ?? Number(data?.expiresAt || 0);
        if (data && Number(data.authTime) === expectedAuthTime && expiresAt > Date.now()) {
          handleAuthApproved({ uid: expectedUid, source: 'ServerVerifiedSession' });
        }
      }, (err) => console.warn('Verified admin session listener note:', err));
    }

    // All active challenges are server-managed. No browser-only fallback may
    // convert a storage or broadcast message into an administrator session.
    return undefined;
  }, [emailLinkSentState, onLoginSuccess]);

  // WINDOW 2 VERIFIER: Check on mount if current URL is an Email Sign-In verification link
  const proofStartedRef = useRef(false);
  useEffect(() => {
    if (isAuthActionUrl) return;
    // Browser-generated Firebase email links were retired. Only the random
    // server proof in #staff_challenge is accepted below.

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
    const cleanEmail = String(firebaseUser.email || '').trim().toLowerCase();
    const strictRole = getStrictCanonicalRole(cleanEmail, profile);
    const isSuper = strictRole === ROLES.SUPER_ADMIN || profile?.role === 'SuperAdmin' || isBootstrapSuperAdminEmail(cleanEmail);
    const isAdmin = isSuper || strictRole === ROLES.STANDARD_ADMIN || profile?.isAdmin || profile?.role === 'Admin';
    if (!isAdmin) return false;
    setSelectedRole(isSuper ? 'superadmin' : 'admin');
    try {
      const handshakeResult = await createAdminLoginHandshake(cleanEmail);
      const handshakeId = handshakeResult?.handshakeId;
      const expiresAt = handshakeResult?.expiresAt || (Date.now() + 10 * 60 * 1000);
      const tokenResult = await getIdTokenResult(firebaseUser, true);
      setEmailLinkSentState({
        email: cleanEmail,
        handshakeId,
        sentAt: Date.now(),
        expiresAt,
        role: profile.role,
        uid: firebaseUser.uid,
        authTime: Number(tokenResult.claims?.auth_time || 0),
        serverManaged: true
      });
      setResendCooldown(60);
      setAlert({ type: 'success', text: `🛡️ Verification link dispatched to ${cleanEmail}. Check your inbox to complete sign-in (valid for 10 minutes).` });
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Admin 2SV dispatch error:', err);
      try {
        localStorage.removeItem('hss_pending_admin_login');
        sessionStorage.removeItem('hss_auth_handshake_id');
      } catch (_) {}
      setAlert({ type: 'error', text: err.message || 'Failed to dispatch verification link.' });
      setIsLoading(false);
      return true;
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const cleanEmail = String(fbUser.email || '').toLowerCase().trim();
      const displayName = fbUser.displayName || cleanEmail.split('@')[0];

      // Authoritatively resolve whether this user is an authorized Staff member
      const staffProfile = await resolveStaffRoleAndPerms(fbUser);
      const strictRole = getStrictCanonicalRole(cleanEmail, staffProfile);
      const isSuper = strictRole === ROLES.SUPER_ADMIN;
      const isAdmin = isSuper || strictRole === ROLES.STANDARD_ADMIN;
      const isTeacher = strictRole === ROLES.TEACHER;
      const isStaff = isSuper || isAdmin || isTeacher;

      // Save demographic profile using UID as document ID without erasing staff roles
      try {
        const userPayload = enforceStrictRoleAttributes({
          uid: fbUser.uid,
          email: cleanEmail,
          name: displayName,
          mobile: fbUser.phoneNumber || staffProfile?.mobile || '',
          role: strictRole,
          perms: staffProfile?.perms || (isSuper ? ['*'] : (isTeacher ? ['attendanceMgmt', 'practicals'] : (isAdmin ? ['reports'] : []))),
          subject: isTeacher ? (staffProfile?.subject || staffProfile?.teachingSubject || '') : '',
          teachingSubject: isTeacher ? (staffProfile?.teachingSubject || staffProfile?.subject || '') : '',
          assignedSubjects: isTeacher ? (staffProfile?.assignedSubjects || []) : [],
          assignedClasses: isTeacher ? (staffProfile?.assignedClasses || []) : [],
          classSubjectMap: isTeacher ? (staffProfile?.classSubjectMap || null) : null,
          tierSubjects: isTeacher ? (staffProfile?.tierSubjects || null) : null,
          isStaff,
          requestedRole: strictRole,
          updatedAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'users', fbUser.uid), userPayload, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore profile sync note:', fsErr);
      }

      // --- 1. TEACHER TAB ACCESS (STRICT SINGLE ROLE) ---
      if (selectedRole === 'teacher') {
        if (!isTeacher) {
          await signOut(auth).catch(() => {});
          const hint = isAdmin
            ? 'Access Denied: This account is registered strictly as Administrator. One email can only have one role. Please use the Admin Login tab.'
            : 'Access Denied: This account is registered strictly as Student. One email can only have one role.';
          setAlert({ type: 'error', text: hint });
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

      // --- 2. ADMIN TAB / ROLES (STRICT SINGLE ROLE) ---
      if (selectedRole === 'admin' || selectedRole === 'superadmin') {
        if (!isAdmin || (selectedRole === 'superadmin' && !isSuper)) {
          await signOut(auth).catch(() => {});
          const hint = isTeacher
            ? 'Access Denied: This account is registered strictly as Faculty/Teacher. One email can only have one role. Please use the Faculty Login tab.'
            : 'Access Denied: You do not have administrator privileges.';
          setAlert({ type: 'error', text: hint });
          setIsLoading(false);
          return;
        }

        const siteSettings = await loadSiteSettings().catch(() => null);
        const require2Step = siteSettings?.enableAdmin2StepVerification ?? false;

        if (require2Step) {
          await beginAdminLogin(fbUser, staffProfile);
          return;
        }

        // Direct entry for all authorized administrative accounts signing in with Google OAuth
        const verifiedSession = await createVerifiedSession(fbUser, cleanEmail, staffProfile);
        verifiedSession.redirectPath = '/portal/admin';
        const roleLabel = isSuper ? 'Super Admin' : (verifiedSession.user.name || 'Administrator');
        setAlert({ type: 'success', text: `Welcome back, ${roleLabel}! Unlocking Admin Portal...` });
        onLoginSuccess(verifiedSession, keepLoggedIn);
        return;
      }

      // --- 3. STUDENT TAB (DEFAULT / AUTO-ROUTE STRICT ROLE) ---
      if (isAdmin) {
        const siteSettings = await loadSiteSettings().catch(() => null);
        const require2Step = siteSettings?.enableAdmin2StepVerification ?? false;
        if (require2Step) {
          await beginAdminLogin(fbUser, staffProfile);
          return;
        }
        const verifiedSession = await createVerifiedSession(fbUser, cleanEmail, staffProfile);
        verifiedSession.redirectPath = '/portal/admin';
        setAlert({
          type: 'success',
          text: `Welcome back, ${verifiedSession.user.name}! Your account is strictly Administrator. Redirecting to Admin Portal...`
        });
        onLoginSuccess(verifiedSession, keepLoggedIn);
        return;
      }
      const verifiedSession = await createVerifiedSession(fbUser, cleanEmail, staffProfile);
      if (isTeacher) {
        incrementTeacherLoginCount(cleanEmail).catch(() => {});
        verifiedSession.redirectPath = '/portal/teacher';
        setAlert({ type: 'success', text: `Welcome back, ${verifiedSession.user.name}! Your account is strictly Faculty/Teacher. Redirecting to Teacher Portal...` });
      } else {
        verifiedSession.redirectPath = '/portal/student';
        setAlert({ type: 'success', text: 'Login successful! Redirecting to Student Portal...' });
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
      const handshakeId = handshakeResult?.handshakeId;
      const expiresAt = handshakeResult?.expiresAt || (Date.now() + 10 * 60 * 1000);
      const tokenResult = await getIdTokenResult(auth.currentUser, true);
      setEmailLinkSentState(prev => ({
        ...(prev || {}), email: cleanEmail, handshakeId, sentAt: Date.now(), expiresAt,
        uid: auth.currentUser?.uid || prev?.uid,
        authTime: Number(tokenResult.claims?.auth_time || prev?.authTime || 0),
        serverManaged: true
      }));
      setResendCooldown(60);
      setAlert({ type: 'success', text: `Fresh 2-step verification link sent to ${cleanEmail}! (Valid for 10 minutes)` });
    } catch (err) {
      console.error('Resend verification link error:', err);
      setAlert({ type: 'error', text: err.message || 'Failed to resend link. Please try again in a moment.' });
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
      await setPersistence(auth, browserLocalPersistence);
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);

      // 2. Resolve account profile from Firestore (configured strictly by Super Admin)
      const staffProfile = await resolveStaffRoleAndPerms(cleanEmail);
      const strictRole = getStrictCanonicalRole(cleanEmail, staffProfile);
      const isSuper = strictRole === ROLES.SUPER_ADMIN;
      const isAdmin = isSuper || strictRole === ROLES.STANDARD_ADMIN;
      const isTeacher = strictRole === ROLES.TEACHER;

      // 3. STRICT TAB & ROLE ACCESS CONTROL

      // --- ADMIN TAB ACCESS GUARD (STRICT: Block non-admins without triggering 2SV) ---
      if (selectedRole === 'admin' || selectedRole === 'superadmin') {
        if (!isAdmin || (selectedRole === 'superadmin' && !isSuper)) {
          await signOut(auth).catch(() => {});
          const hint = isTeacher
            ? 'Access Denied: This account is registered strictly as Faculty/Teacher. One email can only hold one role. Please use the Faculty Login tab.'
            : 'Access Denied: You do not have administrator privileges.';
          setAlert({ type: 'error', text: hint });
          setIsLoading(false);
          return;
        }

        // Check if 2-Step Verification is required for admin email/password login
        const siteSettings = await loadSiteSettings().catch(() => null);
        const require2Step = siteSettings?.enableAdmin2StepVerification ?? false;

        if (require2Step) {
          if (await beginAdminLogin(userCred.user, staffProfile)) return;
        }

        // Direct verified admin sign-in with authenticated credentials
        const verifiedSession = await createVerifiedSession(userCred.user, cleanEmail, staffProfile);
        verifiedSession.redirectPath = '/portal/admin';
        setAlert({ type: 'success', text: 'Login successful! Redirecting to Admin Portal...' });
        onLoginSuccess(verifiedSession, keepLoggedIn);
        return;
      }

      // --- TEACHER TAB ACCESS (STRICT SINGLE ROLE) ---
      if (selectedRole === 'teacher') {
        if (!isTeacher) {
          await signOut(auth).catch(() => {});
          const hint = isAdmin
            ? 'Access Denied: This account is registered strictly as Administrator. One email can only hold one role. Please switch to the Admin Login tab.'
            : 'Access Denied: Unauthorized account for Faculty Portal. One email can only hold one role.';
          setAlert({ type: 'error', text: hint });
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

      // --- AUTO-RECOGNIZE ADMIN / SUPERADMIN ACCOUNT (On Student Tab) ---
      if (isAdmin && selectedRole === 'student') {
        const siteSettings = await loadSiteSettings().catch(() => null);
        const require2Step = siteSettings?.enableAdmin2StepVerification ?? false;
        if (require2Step) {
          if (await beginAdminLogin(userCred.user, staffProfile)) return;
        }
        const verifiedSession = await createVerifiedSession(userCred.user, cleanEmail, staffProfile);
        verifiedSession.redirectPath = '/portal/admin';
        setAlert({
          type: 'success',
          text: `Welcome back, ${verifiedSession.user.name}! Your account is strictly Administrator. Redirecting to Admin Portal...`
        });
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
          text: `Welcome back, ${verifiedSession.user.name}! Your account is strictly Faculty/Teacher. Redirecting to Teacher Portal...`
        });
        onLoginSuccess(verifiedSession, keepLoggedIn);
        return;
      }

      // --- STUDENT TAB ACCESS (OR DEFAULT) ---
      const verifiedSession = await createVerifiedSession(userCred.user, cleanEmail, staffProfile);
      verifiedSession.redirectPath = '/portal/student';
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

  // Comprehensive Institutional ERP Pillars Specification
  const ERP_PILLARS = {
    student: {
      id: 'student',
      tabLabel: 'Students',
      badge: 'Student Services Desk',
      title: 'Online Admissions & Academic Dashboard',
      desc: 'Self-service digital desk for admission applications, exam cards, fees, and results.',
      themeClass: 'bg-teal-500/10 text-teal-600 border border-teal-500/20',
      icon: GraduationCap,
      modules: [
        { name: 'Online Admissions', desc: 'Provisional & regular forms, photo compression' },
        { name: 'Roll Slips & Admit Cards', desc: 'Instant downloadable exam slips with QR' },
        { name: 'Digital Fee Receipts', desc: 'Session receipts & transparent ledger' },
        { name: 'Marks & Evaluations', desc: 'Pre-Board & term evaluation lookup' },
        { name: 'Attendance & Allocation', desc: 'Daily attendance rolls & elective subjects' },
        { name: 'Application Tracker', desc: 'Multi-application tracker & profile updates' }
      ],
      quickLinks: [
        { label: 'Check Results', to: '/results', icon: Search },
        { label: 'Admissions 2026', to: '/admissions', icon: ArrowRight }
      ]
    },
    teacher: {
      id: 'teacher',
      tabLabel: 'Faculty',
      badge: 'Faculty Academic Workspace',
      title: 'Staff & Practical Evaluation Portal',
      desc: 'Daily attendance, subject practicals, theory marks, and award rolls.',
      themeClass: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
      icon: UserCheck,
      modules: [
        { name: 'Attendance Registers', desc: 'Daily roll calls & monthly aggregations' },
        { name: 'Practicals & Theory Marks', desc: 'Keyboard entry, auto-save & validation' },
        { name: '1-Click PDF Award Rolls', desc: 'Official print-ready J&K award sheets' },
        { name: 'Tier-Isolated Rosters', desc: 'Secondary (9-10) & Higher Sec (11-12)' },
        { name: 'Subject Allocation', desc: 'Stream & subject assignment desk' },
        { name: 'Approval Workflow', desc: 'Real-time teacher-admin mark sync' }
      ],
      quickLinks: [
        { label: 'Browse Notices', to: '/notices', icon: FileText },
        { label: 'Academics', to: '/academics', icon: BookOpen }
      ]
    },
    admin: {
      id: 'admin',
      tabLabel: 'Admin',
      badge: 'Institutional Control Center',
      title: 'Master School Management Suite',
      desc: 'Institutional registers, automated roll numbers, certificate studio, ID cards & finance.',
      themeClass: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
      icon: Lock,
      modules: [
        { name: 'Admission Registers', desc: 'Tabular class registers & photo rolls' },
        { name: 'Roll No Auto-Assigner', desc: 'Sequential numbering by stream & merit' },
        { name: 'Certificate Studio', desc: 'Bonafide, Character & Transfer certs' },
        { name: 'Student ID Cards', desc: 'Bulk scannable ID cards with live QR' },
        { name: 'School Accounts', desc: 'Cashbook, fee ledger & financial audits' },
        { name: 'Staff Permissions', desc: 'Granular RBAC & 2-Step verification' }
      ],
      quickLinks: [
        { label: 'Verify Student', to: '/verify-student', icon: ShieldCheck },
        { label: 'Public Results', to: '/results', icon: Search }
      ]
    },
    public: {
      id: 'public',
      tabLabel: 'Public',
      badge: 'Public Services & Transparency',
      title: 'Digital Campus & Verification Hub',
      desc: 'Instant public services: exam scorecards, record verification, and notice boards.',
      themeClass: 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/20',
      icon: Globe,
      modules: [
        { name: 'Public Result Lookup', desc: '9th to 12th tabulated marksheets' },
        { name: 'Live QR Verification', desc: 'Instant student & document checks' },
        { name: 'Notice Board & Orders', desc: 'Official orders & date sheet notices' },
        { name: 'Entrance Test Desk', desc: 'Entrance registration & merit lists' },
        { name: 'Curriculum & Streams', desc: 'Science, Arts, Commerce & Vocational' },
        { name: 'Official Helpdesk', desc: 'Direct Principal & VP contact desks' }
      ],
      quickLinks: [
        { label: 'Check Results', to: '/results', icon: Search },
        { label: 'Verify Student', to: '/verify-student', icon: ShieldCheck },
        { label: 'Notices', to: '/notices', icon: FileText }
      ]
    }
  };

  // State for active ERP pillar tab displayed in the showcase
  const [showcaseTab, setShowcaseTab] = useState(
    selectedRole === 'teacher' ? 'teacher' : (selectedRole === 'admin' || isSuperAdmin ? 'admin' : 'student')
  );
  const [mobileModulesExpanded, setMobileModulesExpanded] = useState(false);

  // Sync showcaseTab when user changes role on the login form
  useEffect(() => {
    if (selectedRole === 'teacher') setShowcaseTab('teacher');
    else if (selectedRole === 'admin' || selectedRole === 'superadmin' || isSuperAdmin) setShowcaseTab('admin');
    else setShowcaseTab('student');
  }, [selectedRole, isSuperAdmin]);

  const currentPillar = ERP_PILLARS[showcaseTab] || ERP_PILLARS.student;
  const PillarIcon = currentPillar.icon;

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
        <div className="lg:col-span-6 space-y-3 text-left hidden md:block px-2 sm:px-3">

          {/* Institution Header Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-slate-900/5 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-2xs backdrop-blur-md">
            <School size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Govt. Higher Secondary School Shangus</span>
          </div>

          {/* Main Hero Title */}
          <div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-tight uppercase">
              <span className="moving-gradient-subtle">Digital Campus</span>{' '}
              <span className="moving-gradient-text">&amp; ERP Suite</span>
            </div>
            <p className="text-xs sm:text-[12.5px] font-bold text-slate-600 dark:text-slate-400 mt-1 leading-relaxed max-w-lg">
              Unified institutional platform powering admissions, examination evaluation, verifiable registers, and transparent public services.
            </p>
          </div>

          {/* Interactive 4-Pillar Tabs */}
          <div className="grid grid-cols-4 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800/90 text-[11px] font-black shadow-2xs">
            {[
              { id: 'student', label: 'Students', icon: GraduationCap },
              { id: 'teacher', label: 'Faculty', icon: UserCheck },
              { id: 'admin', label: 'Admin', icon: Lock },
              { id: 'public', label: 'Public', icon: Globe }
            ].map(tab => {
              const TabIcon = tab.icon;
              const isActive = showcaseTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setShowcaseTab(tab.id)}
                  className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-xs font-black border border-slate-200/70 dark:border-slate-700/70'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white font-extrabold'
                  }`}
                >
                  <TabIcon size={12} className={isActive ? 'text-teal-600 dark:text-teal-400' : 'opacity-70'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Active Role / Pillar Feature Card */}
          <div className="rounded-2xl p-4 border shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/80 dark:border-slate-800/80 space-y-2.5 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${currentPillar.themeClass}`}>
                  <PillarIcon size={18} />
                </div>
                <div>
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block leading-tight">
                    {currentPillar.badge}
                  </span>
                  <h3 className="text-[13px] font-black text-slate-900 dark:text-white leading-tight">
                    {currentPillar.title}
                  </h3>
                </div>
              </div>

              <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                <CheckCircle2 size={11} /> Active Desk
              </span>
            </div>

            <p className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-400 leading-snug">
              {currentPillar.desc}
            </p>

            {/* Compact 2-Column Grid of 6 Key Features */}
            <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              {currentPillar.modules.map((mod, idx) => (
                <div key={idx} className="p-1.5 rounded-lg bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80 flex flex-col justify-start">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800 dark:text-slate-200">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                    <span className="truncate">{mod.name}</span>
                  </div>
                  <span className="text-[9.5px] font-medium text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5 pl-3 leading-tight">
                    {mod.desc}
                  </span>
                </div>
              ))}
            </div>

            {/* Direct Visitor Action Bar */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-1.5 text-[10.5px]">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Direct Access:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentPillar.quickLinks.map((ql, idx) => {
                  const QlIcon = ql.icon || ArrowRight;
                  return (
                    <Link
                      key={idx}
                      to={ql.to}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800/80 transition-colors cursor-pointer"
                    >
                      <QlIcon size={10.5} />
                      <span>{ql.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick System Stats Footer Bar */}
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 pt-0.5 px-1">
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

          <div className={`portal-auth-card rounded-2xl sm:rounded-3xl p-3.5 xs:p-4 sm:p-5.5 border shadow-lg sm:shadow-xl transition-all duration-300 relative overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl ${
            activeTheme.cardBorder
          }`}>

            {/* Loading blur overlay with full theme contrast support */}
            {isLoading && (
              <div
                className="portal-loading-overlay absolute inset-0 z-50 rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center p-4 animate-fadeIn bg-white/95 dark:bg-slate-950/95 backdrop-blur-md"
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
                    setAlert(null);
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
                  setAlert(null);
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
                  setAlert(null);
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
                  setAlert(null);
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
                    setAlert(null);
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
                      onChange={(e) => { setEmail(e.target.value); if (alert) setAlert(null); }}
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
                      onChange={(e) => { setPassword(e.target.value); if (alert) setAlert(null); }}
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

          {/* MOBILE-ONLY COMPACT ERP ECOSYSTEM EXPANDER */}
          <div className="md:hidden mt-3 w-full animate-fadeIn">
            <button
              type="button"
              onClick={() => setMobileModulesExpanded(!mobileModulesExpanded)}
              className="w-full py-2 px-3 rounded-xl border bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-slate-200/90 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 shadow-2xs hover:border-teal-500/50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="font-black text-slate-900 dark:text-slate-100 text-[11.5px]">
                  {mobileModulesExpanded ? 'Hide ERP Capabilities' : 'Explore All ERP Modules & Services'}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center gap-1">
                <span>{mobileModulesExpanded ? 'Hide' : '4 Pillars'}</span>
                {mobileModulesExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </span>
            </button>

            {mobileModulesExpanded && (
              <div className="mt-2 p-3 rounded-2xl border bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200/90 dark:border-slate-800 shadow-md space-y-2.5 animate-fadeIn">
                {/* 4 Tabs on Mobile */}
                <div className="grid grid-cols-4 p-0.5 rounded-xl bg-slate-100/90 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800/90 text-[10px] font-black">
                  {[
                    { id: 'student', label: 'Students', icon: GraduationCap },
                    { id: 'teacher', label: 'Faculty', icon: UserCheck },
                    { id: 'admin', label: 'Admin', icon: Lock },
                    { id: 'public', label: 'Public', icon: Globe }
                  ].map(tab => {
                    const TabIcon = tab.icon;
                    const isActive = showcaseTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setShowcaseTab(tab.id)}
                        className={`py-1.5 px-0.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-xs font-black border border-slate-200/70 dark:border-slate-700/70'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white font-extrabold'
                        }`}
                      >
                        <TabIcon size={11} className={isActive ? 'text-teal-600 dark:text-teal-400' : 'opacity-70'} />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Mobile Active Pillar Info */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                        {currentPillar.badge}
                      </span>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {currentPillar.title}
                      </h4>
                    </div>
                    <span className="text-[9.5px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Active
                    </span>
                  </div>

                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-snug">
                    {currentPillar.desc}
                  </p>

                  <div className="grid grid-cols-1 gap-1.5 pt-1">
                    {currentPillar.modules.map((mod, idx) => (
                      <div key={idx} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                          <span>{mod.name}</span>
                        </div>
                        <span className="text-[9.5px] text-slate-600 dark:text-slate-400 block pl-3 leading-tight mt-0.5 font-medium">
                          {mod.desc}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Mobile Quick Links */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
                    <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase">Direct Access:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {currentPillar.quickLinks.map((ql, idx) => {
                        const QlIcon = ql.icon || ArrowRight;
                        return (
                          <Link
                            key={idx}
                            to={ql.to}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800/80"
                          >
                            <QlIcon size={10} />
                            <span>{ql.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
