import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { sessionManager } from '../../services/sessionManager';
import appsScriptApi from '../../services/appsScriptApi'; // kept for legacy heartbeat/logout only
import { auth, db } from '../../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Shared helper: resolve user profile from Firestore by email
// Always returns { role, name } — never throws
// ---------------------------------------------------------------------------
async function resolveUserProfile(email, fallbackRole = 'Student', fallbackName = null) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  if (!cleanEmail) return { role: fallbackRole, name: fallbackName || cleanEmail };

  // SuperAdmin shortcut
  if (cleanEmail === 'adm.exam.hss.shangus@gmail.com') {
    return { role: 'SuperAdmin', name: fallbackName || 'Sheikh Gulfam (SuperAdmin)' };
  }

  try {
    // 1. Direct document lookup
    const snap = await getDoc(doc(db, 'users', cleanEmail));
    if (snap.exists()) {
      const d = snap.data();
      return {
        role: d.Role || d.role || fallbackRole,
        name: d.Name || d.name || fallbackName || cleanEmail,
      };
    }

    // 2. Query by email field (lowercase)
    let q = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail)));
    if (q.empty) q = await getDocs(query(collection(db, 'users'), where('Email', '==', cleanEmail)));
    if (!q.empty) {
      const d = q.docs[0].data();
      return {
        role: d.Role || d.role || fallbackRole,
        name: d.Name || d.name || fallbackName || cleanEmail,
      };
    }
  } catch (e) {
    console.warn('resolveUserProfile note:', e);
  }

  return { role: fallbackRole, name: fallbackName || cleanEmail };
}

/**
 * PortalLayout — Wrapper for all /portal/* routes.
 *
 * Handles:
 * - Session validation on mount (synchronous — no flicker)
 * - Firebase Auth state sync (async — fires once after mount)
 * - Periodic heartbeat for legacy Apps Script sessions only
 * - Redirects unauthenticated users to /portal/login
 * - Provides session context to child routes via Outlet props
 */
export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Public routes that don't require authentication
  const publicPaths = ['/portal/login', '/portal/register', '/portal/forgot-password'];
  const isPublicRoute = publicPaths.some(p => location.pathname.startsWith(p));

  // ---------------------------------------------------------------------------
  // Synchronous initial session state — reads from localStorage/sessionStorage
  // immediately (0ms latency, no flicker on page load/refresh)
  // ---------------------------------------------------------------------------
  const [sessionState, setSessionState] = useState(() => {
    const session = sessionManager.getSession();
    if (session && session.token) {
      return { loading: false, user: session.user, isAuthenticated: true };
    }
    return { loading: false, user: null, isAuthenticated: false };
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
    if (!isPublicRoute && !sessionManager.getSession() && !auth.currentUser) {
      navigate('/portal/login', { replace: true });
    }
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
      if (fbUser) {
        // Skip if user explicitly logged out
        if (sessionStorage.getItem('hss_explicit_logout') === 'true') return;

        // Skip on public routes — LoginPage handles its own session flow.
        // Without this, onAuthStateChanged races with onLoginSuccess causing
        // the dashboard to mount → unmount → remount (visible as flickering).
        const currentPath = window.location.pathname;
        const isOnPublicPage = ['/portal/login', '/portal/register', '/portal/forgot-password']
          .some(p => currentPath.startsWith(p));
        if (isOnPublicPage) return;

        const cleanEmail = String(fbUser.email || '').toLowerCase().trim();
        const currentSession = sessionManager.getSession();

        // Session already active for this user — no state update needed
        if (currentSession?.user && String(currentSession.user.email || '').toLowerCase().trim() === cleanEmail) {
          return;
        }

        // No session yet (e.g. page refresh with Firebase still signed in)
        if (!currentSession?.user) {
          const { role: userRole, name: displayName } = await resolveUserProfile(
            cleanEmail,
            'Student',
            fbUser.displayName || cleanEmail
          );

          const defaultSession = {
            email: cleanEmail,
            name: displayName,
            role: userRole,
            token: await fbUser.getIdToken().catch(() => `fb_token_${Date.now()}`),
          };
          sessionManager.saveSession({ user: defaultSession, token: defaultSession.token }, true);
          setSessionStateStable({ loading: false, user: defaultSession, isAuthenticated: true });
        }
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
        navigate('/portal/login', { replace: true });
      }
    };
    window.addEventListener('hss-auth-changed', handleAuthChanged);
    return () => window.removeEventListener('hss-auth-changed', handleAuthChanged);
  }, [navigate, setSessionStateStable]);

  // ---------------------------------------------------------------------------
  // Heartbeat (periodic session refresh — legacy Apps Script sessions only)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionState.isAuthenticated) return;

    const interval = setInterval(async () => {
      if (sessionManager.isHeartbeatDue()) {
        const session = sessionManager.getSession();
        const token = session?.token || '';
        const isLegacySession = token && !token.startsWith('fb_token_');
        if (!isLegacySession) {
          sessionManager.recordHeartbeat(); // silent — no network call for Firebase users
          return;
        }
        try {
          await appsScriptApi.heartbeat();
          sessionManager.recordHeartbeat();
        } catch (error) {
          console.warn('Background heartbeat note (retaining session):', error);
        }
      }
    }, sessionManager.HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [sessionState.isAuthenticated]);

  // ---------------------------------------------------------------------------
  // Handle login success (called from LoginPage)
  // ---------------------------------------------------------------------------
  const handleLoginSuccess = useCallback((loginResult, keepLoggedIn) => {
    sessionStorage.removeItem('hss_explicit_logout');

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

    appsScriptApi.logout().catch(() => {});

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
      <div className="portal-loading-screen">
        <div className="portal-loader-content">
          <div className="portal-spinner"></div>
          <p style={{ color: 'var(--text-muted, #94a3b8)', marginTop: '1rem', fontSize: '0.9rem' }}>
            Validating session...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render child routes with context
  // ---------------------------------------------------------------------------
  return (
    <Outlet context={{
      user: sessionState.user,
      isAuthenticated: sessionState.isAuthenticated,
      onLoginSuccess: handleLoginSuccess,
      onLogout: handleLogout,
      refreshSession,
    }} />
  );
}
