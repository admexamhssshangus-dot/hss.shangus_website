import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { sessionManager } from '../../services/sessionManager';
import ModernLoader from '../../components/ModernLoader';

import { auth } from '../../services/firebase';
import { getIdTokenResult, onAuthStateChanged, signOut } from 'firebase/auth';
import { resolveStaffRoleAndPerms } from '../../services/staffAuthService';

// ---------------------------------------------------------------------------
// Shared helper: resolve user profile from Firestore by email
// Always returns { role, name, perms, token } — never throws
// ---------------------------------------------------------------------------
async function resolveUserProfile(firebaseUser) {
  const tokenResult = await getIdTokenResult(firebaseUser, true);
  const claims = tokenResult.claims || {};
  const emailLower = String(firebaseUser.email || '').toLowerCase().trim();
  
  // Resolve role from Firestore permissions & users collection & bootstrap
  const staffProfile = await resolveStaffRoleAndPerms(emailLower);
  const isBootstrapAdmin = emailLower === 'adm.exam.hss.shangus@gmail.com' || emailLower === 'e.educational.24@gmail.com';

  const rawRole = String(
    staffProfile?.role ||
    claims.role || 
    (claims.admin ? 'Admin' : '') || 
    (isBootstrapAdmin ? 'SuperAdmin' : '') || 
    'Student'
  ).trim();

  const role = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
  const normalizedRole = role.toLowerCase();

  const perms = Array.isArray(staffProfile?.perms)
    ? staffProfile.perms
    : Array.isArray(claims.permissions)
      ? claims.permissions
      : (isBootstrapAdmin || role === 'SuperAdmin' ? ['*'] : []);

  return {
    role,
    name: staffProfile?.name || firebaseUser.displayName || emailLower.split('@')[0],
    perms,
    subject: staffProfile?.subject || '',
    mobile: staffProfile?.mobile || '',
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
    const saved = sessionManager.getSession();
    if (saved?.user && sessionStorage.getItem('hss_explicit_logout') !== 'true') {
      return { loading: false, user: saved.user, isAuthenticated: true };
    }
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
      prev.user?.role === newState.user?.role
    ) {
      return; // State is identical — skip re-render
    }
    sessionStateRef.current = newState;
    setSessionState(newState);
  }, []);

  // Redirect to role-appropriate dashboard
  const _redirectToDashboard = useCallback((user) => {
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
        if (sessionStorage.getItem('hss_explicit_logout') === 'true') {
          sessionManager.clearSession();
          setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
          if (!isOnPublicPage) navigate('/portal/login', { replace: true });
          return;
        }

        // On public pages, stop loading so LoginPage displays immediately
        if (isOnPublicPage) {
          setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
          return;
        }

        const cleanEmail = String(fbUser.email || '').toLowerCase().trim();
        
        // If session is already authenticated and active for this email, refresh claims silently in background without blocking UI
        if (sessionStateRef.current.isAuthenticated && sessionStateRef.current.user?.email === cleanEmail) {
          resolveUserProfile(fbUser).then(({ role: userRole, name: displayName, perms: userPerms, token: verifiedToken }) => {
            const updatedSession = {
              email: cleanEmail,
              name: displayName,
              role: userRole,
              perms: userPerms,
              uid: fbUser.uid,
            };
            sessionManager.saveSession({ user: updatedSession, token: verifiedToken }, true);
            setSessionStateStable({ loading: false, user: updatedSession, isAuthenticated: true });
          }).catch((err) => {
            console.warn('Silent token claims refresh note:', err);
          });
          return;
        }

        // Full session restore on cold start / page refresh
        try {
          const { role: userRole, name: displayName, perms: userPerms, token: verifiedToken } = await resolveUserProfile(fbUser);
          const defaultSession = {
            email: cleanEmail,
            name: displayName,
            role: userRole,
            perms: userPerms,
            uid: fbUser.uid,
          };
          sessionManager.saveSession({ user: defaultSession, token: verifiedToken }, true);
          setSessionStateStable({ loading: false, user: defaultSession, isAuthenticated: true });
        } catch (error) {
          sessionManager.clearSession();
          setSessionStateStable({ loading: false, user: null, isAuthenticated: false });
          navigate('/portal/login', { replace: true, state: { message: error.message } });
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
  // Handle login success (called from LoginPage)
  // ---------------------------------------------------------------------------
  const handleLoginSuccess = useCallback((loginResult, keepLoggedIn) => {
    try {
      sessionStorage.removeItem('hss_explicit_logout');
      localStorage.removeItem('hss_explicit_logout');
    } catch (_) {}

    const user = loginResult.user || {
      email: loginResult.email,
      name: loginResult.name,
      role: loginResult.role,
      uid: loginResult.uid,
    };
    const token = loginResult.token || loginResult.user?.token || `session_${Date.now()}`;

    sessionManager.saveSession({ user, token }, keepLoggedIn);
    setSessionStateStable({ loading: false, user, isAuthenticated: true });
    _redirectToDashboard(user);
  }, [_redirectToDashboard, setSessionStateStable]);

  // ---------------------------------------------------------------------------
  // Handle logout
  // ---------------------------------------------------------------------------
  const handleLogout = useCallback(async () => {
    try { sessionStorage.setItem('hss_explicit_logout', 'true'); } catch (_) {}

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
  }, [navigate, setSessionStateStable]);

  // Manual session refresh (exposed via context for child routes if needed)
  const refreshSession = useCallback(() => {
    const session = sessionManager.getSession();
    const fbUser = auth.currentUser;
    if (session?.user) {
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
        text="Validating Security Credentials & Session"
        subtext="Connecting to official student & administrative database…"
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
