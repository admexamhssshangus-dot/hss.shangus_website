import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { sessionManager } from '../../services/sessionManager';
import ModernLoader from '../../components/ModernLoader';
import '../portal.css';

import { auth } from '../../services/firebase';
import { getIdTokenResult, onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  resolveStaffRoleAndPerms, 
  requireVerifiedAdminSession, 
  isBootstrapSuperAdminEmail, 
  isBootstrapAdminEmail,
  clearStaffProfileCache 
} from '../../services/staffAuthService';

// ---------------------------------------------------------------------------
// Shared helper: resolve user profile from Firestore by email
// Always returns { role, name, perms, token } — never throws
// ---------------------------------------------------------------------------
async function resolveUserProfile(firebaseUser, forceFresh = false) {
  // Use cached token by default to eliminate slow blocking STS roundtrips over mobile networks
  const tokenResult = await getIdTokenResult(firebaseUser, false);
  const claims = tokenResult.claims || {};
  const emailLower = String(firebaseUser.email || '').toLowerCase().trim();
  const isBootstrapAdmin = isBootstrapAdminEmail(emailLower) || isBootstrapSuperAdminEmail(emailLower);
  
  // Resolve role from Firestore permissions & users collection & bootstrap
  const staffProfile = await resolveStaffRoleAndPerms(emailLower, forceFresh);

  const rawRole = staffProfile?.role || 'Student';

  const role = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
  const normalizedRole = role.toLowerCase();
  if (normalizedRole.includes('admin')) await requireVerifiedAdminSession(firebaseUser);

  const isSuper = isBootstrapSuperAdminEmail(emailLower) || role === 'SuperAdmin';
  const perms = isSuper
    ? ['*']
    : Array.isArray(staffProfile?.perms)
      ? staffProfile.perms
      : Array.isArray(claims.permissions)
        ? claims.permissions
        : (isBootstrapAdmin ? ['reports'] : []);

  const userSubject = staffProfile?.subject || staffProfile?.teachingSubject || '';
  const userTeachingSubject = staffProfile?.teachingSubject || staffProfile?.subject || '';
  const userAssignedClasses = Array.isArray(staffProfile?.assignedClasses)
    ? staffProfile.assignedClasses
    : (staffProfile?.assignedClass ? [staffProfile.assignedClass] : []);
  const userMobile = staffProfile?.mobile || '';

  const userAssignedSubjects = Array.isArray(staffProfile?.assignedSubjects) && staffProfile.assignedSubjects.length > 0
    ? staffProfile.assignedSubjects
    : (staffProfile?.subject ? String(staffProfile.subject).split(/[,;]+/).map(s => s.trim()).filter(Boolean) : []);

  return {
    email: emailLower,
    role,
    name: staffProfile?.name || firebaseUser.displayName || emailLower.split('@')[0],
    perms,
    subject: userSubject,
    teachingSubject: userTeachingSubject,
    assignedSubjects: userAssignedSubjects,
    assignedClasses: userAssignedClasses,
    mobile: userMobile,
    token: tokenResult.token,
  };
}

/**
 * PortalLayout — Wrapper for all /portal/* routes.
 *
 * Handles:
 * - Session validation on mount (synchronous — no flicker)
 * - Firebase Auth state sync (async — fires once after mount)
 * - Silent local heartbeat (no network calls)
 * - Redirects unauthenticated users to /portal/login
 * - Provides session context to child routes via Outlet props
 */
export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Public routes that don't require authentication
  const publicPaths = ['/portal/login', '/portal/register', '/portal/forgot-password', '/portal/auth/action'];
  const isPublicRoute = publicPaths.some(p => location.pathname.startsWith(p));

  // ---------------------------------------------------------------------------
  // Synchronous initial session state — reads from localStorage/sessionStorage
  // immediately (0ms latency, zero flicker on page load/refresh)
  // ---------------------------------------------------------------------------
  const [sessionState, setSessionState] = useState(() => {
    if (isPublicRoute) {
      return { loading: false, user: null, isAuthenticated: false };
    }
    // Cached roles are display data, never proof of authentication.
    return { loading: true, user: null, isAuthenticated: false };
  });

  // ---------------------------------------------------------------------------
  // Stable setState — only triggers a re-render when state actually changes.
  // Prevents the "triple render" caused by redundant setSessionState calls
  // when session is already correctly initialized by the useState initializer.
  // ---------------------------------------------------------------------------
  const sessionStateRef = useRef(sessionState);
  const setSessionStateStable = useCallback((newState) => {
    const prev = sessionStateRef.current;
    if (
      prev.loading === newState.loading &&
      prev.isAuthenticated === newState.isAuthenticated &&
      prev.user?.email === newState.user?.email &&
      JSON.stringify(prev.user) === JSON.stringify(newState.user)
    ) {
      return; // State is identical — skip re-render
    }
    sessionStateRef.current = newState;
    setSessionState(newState);
  }, []);

  // Redirect to role-appropriate dashboard
  const _redirectToDashboard = useCallback((user) => {
    const emailLower = String(user?.email || '').toLowerCase().trim();
    if (isBootstrapSuperAdminEmail(emailLower)) {
      navigate('/portal/admin', { replace: true });
      return;
    }
    const role = (user?.role || '').toLowerCase();
    switch (role) {
      case 'admin':
      case 'superadmin':
      case 'super admin':
        navigate('/portal/admin', { replace: true });
        break;
      case 'teacher':
      case 'faculty':
        navigate('/portal/teacher', { replace: true });
        break;
      default:
        navigate('/portal/student', { replace: true });
    }
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Guard: redirect unauthenticated users to login on mount only.
  // The useState initializer already restores sessions synchronously —
  // this is just the one-time route protection gate.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Firebase's auth-state observer is the authority. Cached browser data is
    // deliberately never accepted as proof of authentication.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← run ONCE on mount only, never on every route change

  // ---------------------------------------------------------------------------
  // Firebase Auth listener — subscribes ONCE on mount, handles:
  //   a) Page refresh with Firebase still signed in (restores session)
  //   b) Silent token refresh from Firebase SDK
  // NOTE: On public routes (login/register), this handler is skipped entirely.
  //       The LoginPage's own onLoginSuccess callback handles session creation
  //       to avoid a race condition that caused multiple dashboard re-renders.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      const currentPath = window.location.pathname;
      const isOnPublicPage = ['/portal/login', '/portal/register', '/portal/forgot-password', '/portal/auth/action']
        .some(p => currentPath.startsWith(p));

      if (fbUser) {
        // Skip if user explicitly logged out
        if (sessionStorage.getItem('hss_explicit_logout') === 'true' || localStorage.getItem('hss_explicit_logout') === 'true') {
          sessionManager.clearSession();
          setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
          if (!isOnPublicPage) navigate('/portal/login', { replace: true });
          return;
        }

        // If 2-step verification is pending, check if already approved or expired before blocking
        const pendingAdminLogin = localStorage.getItem('hss_pending_admin_login');
        if (pendingAdminLogin) {
          try {
            const parsed = JSON.parse(pendingAdminLogin);
            const approvedRaw = localStorage.getItem('hss_admin_auth_approved');
            const isApproved = approvedRaw && JSON.parse(approvedRaw)?.email === parsed?.email;
            const isExpired = !parsed.ts || (Date.now() - parsed.ts > 10 * 60 * 1000);
            if (isApproved || isExpired || sessionManager.isLoggedIn()) {
              localStorage.removeItem('hss_pending_admin_login');
            } else if (!sessionManager.isLoggedIn()) {
              setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
              if (!isOnPublicPage) navigate('/portal/login', { replace: true });
              return;
            }
          } catch (_) {
            localStorage.removeItem('hss_pending_admin_login');
          }
        }

        // On public pages (login, register, etc.), do not auto-elevate session from raw Firebase Auth events
        // unless a valid portal session was already active in sessionManager.
        // LoginPage's onLoginSuccess manages explicit verified session elevation.
        if (isOnPublicPage && !sessionManager.isLoggedIn()) {
          setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
          return;
        }

        const cleanEmail = String(fbUser.email || '').toLowerCase().trim();
        
        // If session is already authenticated and active for this email, refresh claims silently in background without blocking UI
        if (sessionStateRef.current.isAuthenticated && sessionStateRef.current.user?.email === cleanEmail) {
          resolveUserProfile(fbUser, true).then(({ role: userRole, name: displayName, perms: userPerms, subject: userSubj, teachingSubject: userTeachSubj, assignedClasses: userClasses, mobile: userMob, token: verifiedToken }) => {
            if (auth.currentUser?.uid !== fbUser.uid) return;
            const updatedSession = {
              email: cleanEmail,
              name: displayName,
              role: userRole,
              perms: userPerms,
              subject: userSubj || '',
              teachingSubject: userTeachSubj || userSubj || '',
              assignedClasses: userClasses || [],
              mobile: userMob || '',
              uid: fbUser.uid,
            };
            sessionManager.saveSession({ user: updatedSession, token: verifiedToken }, localStorage.getItem('hss_persistent_login') !== 'false');
            setSessionStateStable({ loading: false, user: updatedSession, isAuthenticated: true });
          }).catch((err) => {
            sessionManager.clearSession();
            setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
          });
          return;
        }

        // Full session restore on cold start / page refresh
        try {
          const { role: userRole, name: displayName, perms: userPerms, subject: userSubj, teachingSubject: userTeachSubj, assignedClasses: userClasses, mobile: userMob, token: verifiedToken } = await resolveUserProfile(fbUser, true);
          if (auth.currentUser?.uid !== fbUser.uid) return;
          const defaultSession = {
            email: cleanEmail,
            name: displayName,
            role: userRole,
            perms: userPerms,
            subject: userSubj || '',
            teachingSubject: userTeachSubj || userSubj || '',
            assignedClasses: userClasses || [],
            mobile: userMob || '',
            uid: fbUser.uid,
          };
          sessionManager.saveSession({ user: defaultSession, token: verifiedToken }, localStorage.getItem('hss_persistent_login') !== 'false');
          setSessionStateStable({ loading: false, user: defaultSession, isAuthenticated: true });
        } catch (err) {
          sessionManager.clearSession();
          setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
        }
      } else {
        sessionManager.clearSession();
        setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
        const publicPage = ['/portal/login', '/portal/register', '/portal/forgot-password', '/portal/auth/action']
          .some(p => window.location.pathname.startsWith(p));
        if (!publicPage) navigate('/portal/login', { replace: true });
      }
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty: subscribe exactly once, never re-subscribe on route changes

  // ---------------------------------------------------------------------------
  // Global auth-change sync (fires when any tab changes the session)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleAuthChanged = (e) => {
      if (e.detail?.loggedIn === false) {
        setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
        const publicPage = ['/portal/login', '/portal/register', '/portal/forgot-password', '/portal/auth/action']
          .some((path) => window.location.pathname.startsWith(path));
        if (!publicPage) navigate('/portal/login', { replace: true });
      }
    };
    window.addEventListener('hss-auth-changed', handleAuthChanged);
    return () => window.removeEventListener('hss-auth-changed', handleAuthChanged);
  }, [navigate, setSessionStateStable]);

  // ---------------------------------------------------------------------------
  // Real-time permission matrix synchronization across components & tabs
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handlePermissionsUpdated = () => {
      clearStaffProfileCache();
      const fbUser = auth.currentUser;
      if (fbUser) {
        resolveUserProfile(fbUser, true).then(({ role: userRole, name: displayName, perms: userPerms, subject: userSubj, teachingSubject: userTeachSubj, assignedClasses: userClasses, mobile: userMob, token: verifiedToken }) => {
          if (auth.currentUser?.uid !== fbUser.uid) return;
          const cleanEmail = String(fbUser.email || '').toLowerCase().trim();
          const updatedSession = {
            email: cleanEmail,
            name: displayName,
            role: userRole,
            perms: userPerms,
            subject: userSubj || '',
            teachingSubject: userTeachSubj || userSubj || '',
            assignedClasses: userClasses || [],
            mobile: userMob || '',
            uid: fbUser.uid,
          };
          sessionManager.saveSession({ user: updatedSession, token: verifiedToken }, localStorage.getItem('hss_persistent_login') !== 'false');
          setSessionStateStable({ loading: false, user: updatedSession, isAuthenticated: true });
        }).catch(() => {});
      }
    };

    window.addEventListener('hss-permissions-updated', handlePermissionsUpdated);
    const storageHandler = (e) => {
      if (e.key === 'hss_admin_users_permissions_v1') {
        handlePermissionsUpdated();
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('hss-permissions-updated', handlePermissionsUpdated);
      window.removeEventListener('storage', storageHandler);
    };
  }, [setSessionStateStable]);

  // ---------------------------------------------------------------------------
  // Heartbeat (silent local session keep-alive)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionState.isAuthenticated) return;

    const interval = setInterval(() => {
      if (sessionManager.isHeartbeatDue()) {
        sessionManager.recordHeartbeat();
      }
    }, sessionManager.HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [sessionState.isAuthenticated]);

  // ---------------------------------------------------------------------------
  // Single Active Device Policy — Listen for session revocation from other devices
  // If the user signs into another device, this session is terminated immediately.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionState.isAuthenticated || !sessionState.user?.uid) return;

    let currentSessionId = sessionManager.getSessionId();
    if (!currentSessionId) {
      currentSessionId = sessionManager.generateSessionId();
      sessionManager.setSessionId(currentSessionId);
      sessionManager.registerActiveSessionInCloud(sessionState.user, sessionManager.getDeviceId(), currentSessionId);
    }

    const unsubscribe = sessionManager.listenForSessionRevocation(
      sessionState.user.uid,
      currentSessionId,
      (revocationInfo) => {
        console.warn('Session terminated: logged in on another device', revocationInfo);
        try {
          sessionStorage.setItem('hss_session_terminated', JSON.stringify({
            reason: 'concurrent_device',
            deviceInfo: revocationInfo?.deviceInfo || 'another device',
            time: Date.now(),
          }));
        } catch (_) {}

        try {
          sessionManager.clearSession();
          if (auth?.currentUser) {
            signOut(auth).catch(() => {});
          }
        } catch (_) {}

        setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
        navigate('/portal/login', {
          replace: true,
          state: {
            terminated: true,
            reason: 'concurrent_device',
            deviceInfo: revocationInfo?.deviceInfo || 'another device',
          }
        });
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sessionState.isAuthenticated, sessionState.user?.uid, navigate, setSessionStateStable]);

  // ---------------------------------------------------------------------------
  // Handle login success (called from LoginPage)
  // ---------------------------------------------------------------------------
  const handleLoginSuccess = useCallback(async (loginResult, keepLoggedIn) => {
    try {
      sessionStorage.removeItem('hss_explicit_logout');
      localStorage.removeItem('hss_explicit_logout');
      sessionStorage.removeItem('hss_session_terminated');
    } catch (_) {}

    const user = loginResult.user || {
      email: loginResult.email,
      name: loginResult.name,
      role: loginResult.role,
      uid: loginResult.uid,
    };
    const token = loginResult.token || loginResult.user?.token || `session_${Date.now()}`;
    const sessionId = loginResult.sessionId || sessionManager.getSessionId() || sessionManager.generateSessionId();

    sessionManager.setSessionId(sessionId);
    sessionManager.saveSession({ user, token, sessionId }, keepLoggedIn);
    if (user.uid) {
      await sessionManager.registerActiveSessionInCloud(user, sessionManager.getDeviceId(), sessionId);
    }
    setSessionStateStable({ loading: false, user, isAuthenticated: true });
    if (loginResult.redirectPath) {
      navigate(loginResult.redirectPath, { replace: true });
    } else {
      _redirectToDashboard(user);
    }
  }, [_redirectToDashboard, navigate, setSessionStateStable]);

  // ---------------------------------------------------------------------------
  // Handle logout
  // ---------------------------------------------------------------------------
  const handleLogout = useCallback(async () => {
    try {
      sessionStorage.setItem('hss_explicit_logout', 'true');
      localStorage.setItem('hss_explicit_logout', 'true');
      localStorage.removeItem('hss_pending_admin_login');
      localStorage.removeItem('emailForSignIn');
      localStorage.removeItem('hss_admin_auth_approved');
      sessionStorage.removeItem('hss_auth_handshake_id');
      sessionStorage.removeItem('hss_session_terminated');
    } catch (_) {}

    if (sessionState.user?.uid) {
      sessionManager.clearActiveSessionInCloud(sessionState.user.uid).catch(() => {});
    }

    try {
      if (auth?.currentUser) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn('Firebase signout note:', e);
    }

    sessionManager.clearSession();
    setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
    navigate('/portal/login', { replace: true });
  }, [navigate, sessionState.user?.uid, setSessionStateStable]);

  // Manual session refresh (exposed via context for child routes if needed)
  const refreshSession = useCallback(() => {
    const session = sessionManager.getSession();
    const fbUser = auth.currentUser;
    if (session?.user && fbUser && session.user.uid === fbUser.uid) {
      setSessionStateStable({ loading: false, user: session.user, isAuthenticated: true });
    } else if (!fbUser && !isPublicRoute) {
      navigate('/portal/login', { replace: true });
    }
  }, [isPublicRoute, navigate, setSessionStateStable]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (sessionState.loading) {
    return (
      <ModernLoader
        moduleKey="default"
        text="Checking your session…"
        subtext="Please wait."
        fullScreen
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Render child routes with context
  // ---------------------------------------------------------------------------
  return (
    <div className="portal-shell contents">
      <Outlet context={{
        user: sessionState.user,
        isAuthenticated: sessionState.isAuthenticated,
        onLoginSuccess: handleLoginSuccess,
        onLogout: handleLogout,
        refreshSession,
      }} />
    </div>
  );
}
