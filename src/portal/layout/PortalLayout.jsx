import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { sessionManager } from '../../services/sessionManager';
import appsScriptApi from '../../services/appsScriptApi';
import { auth, db } from '../../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * PortalLayout — Wrapper for all /portal/* routes.
 * 
 * Handles:
 * - Session validation on mount
 * - Periodic heartbeat for active sessions
 * - Redirects unauthenticated users to /portal/login
 * - Provides session context to child routes via props
 */
export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Public routes that don't require authentication
  const publicPaths = ['/portal/login', '/portal/register', '/portal/forgot-password'];
  const isPublicRoute = publicPaths.some(p => location.pathname.startsWith(p));

  // Synchronous initial session state (0ms loading lag)
  const [sessionState, setSessionState] = useState(() => {
    const session = sessionManager.getSession();
    if (session && session.token) {
      return { loading: false, user: session.user, isAuthenticated: true };
    }
    return { loading: false, user: null, isAuthenticated: false };
  });

  // ---------------------------------------------------------------------------
  // Session Validation
  // ---------------------------------------------------------------------------
  // Session Validation (Instant local restoration + async backend check)
  // ---------------------------------------------------------------------------
  const validateCurrentSession = useCallback(async () => {
    const session = sessionManager.getSession();
    const fbUser = auth.currentUser;

    if (!session && !fbUser) {
      setSessionState({ loading: false, user: null, isAuthenticated: false });
      if (!isPublicRoute) {
        navigate('/portal/login', { replace: true });
      }
      return;
    }

    const currentUser = session?.user || (fbUser ? {
      email: fbUser.email,
      name: fbUser.displayName || fbUser.email,
      role: fbUser.email === 'adm.exam.hss.shangus@gmail.com' ? 'SuperAdmin' : 'Student',
    } : null);

    // Instant UI Restoration: Always trust local session / Firebase Auth user
    if (currentUser) {
      setSessionState({ loading: false, user: currentUser, isAuthenticated: true });
      if (isPublicRoute) {
        _redirectToDashboard(currentUser);
      }
    }

    // Async Background Verification (Non-destructive to active session)
    try {
      const result = await appsScriptApi.validateSession();
      if (result && result.success !== false) {
        const user = result.user || currentUser;
        sessionManager.updateUser(user);
        sessionManager.recordHeartbeat();
        setSessionState(prev => ({ ...prev, user }));
      }
    } catch (error) {
      console.warn('Background session validation note (retaining active session):', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicRoute]);

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
  // Global auth-change sync (fires when Navbar or any tab changes the session)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleAuthChanged = (e) => {
      if (e.detail?.loggedIn === false) {
        setSessionState({ loading: false, user: null, isAuthenticated: false });
        navigate('/portal/login', { replace: true });
      }
    };
    window.addEventListener('hss-auth-changed', handleAuthChanged);
    return () => window.removeEventListener('hss-auth-changed', handleAuthChanged);
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Heartbeat (periodic session refresh — non-destructive)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionState.isAuthenticated) return;

    const interval = setInterval(async () => {
      if (sessionManager.isHeartbeatDue()) {
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
  // Initial load
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Skip background auto-session creation if user explicitly clicked Logout
        if (sessionStorage.getItem('hss_explicit_logout') === 'true') {
          return;
        }

        const cleanEmail = String(fbUser.email || '').toLowerCase().trim();
        const currentSession = sessionManager.getSession();

        // If session is already active for this exact user, do not trigger redundant state updates or re-fetches
        if (currentSession && currentSession.user && String(currentSession.user.email || '').toLowerCase().trim() === cleanEmail) {
          return;
        }

        if (!currentSession || !currentSession.user) {
          let userRole = cleanEmail === 'adm.exam.hss.shangus@gmail.com' ? 'SuperAdmin' : 'Student';
          let displayName = fbUser.displayName || cleanEmail;

          try {
            const userDocRef = doc(db, 'users', cleanEmail);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              const uData = userSnap.data();
              userRole = uData.Role || uData.role || userRole;
              displayName = uData.Name || uData.name || displayName;
            } else {
              const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
              const qSnap = await getDocs(q);
              if (!qSnap.empty) {
                const uData = qSnap.docs[0].data();
                userRole = uData.Role || uData.role || userRole;
                displayName = uData.Name || uData.name || displayName;
              }
            }
          } catch (e) {
            console.warn('Profile fetch note in AuthStateChanged:', e);
          }

          const defaultSession = {
            email: cleanEmail,
            name: displayName,
            role: userRole,
            token: fbUser.accessToken || `fb_token_${Date.now()}`,
          };
          sessionManager.saveSession({ user: defaultSession, token: defaultSession.token }, true);
          setSessionState({ loading: false, user: defaultSession, isAuthenticated: true });
        }
      }
    });

    validateCurrentSession();
    return () => unsubscribe();
  }, [validateCurrentSession]);

  // ---------------------------------------------------------------------------
  // Handle login success (called from LoginPage)
  // ---------------------------------------------------------------------------
  const handleLoginSuccess = useCallback((loginResult, keepLoggedIn) => {
    sessionStorage.removeItem('hss_explicit_logout');
    sessionManager.saveSession(loginResult, keepLoggedIn);
    const user = loginResult.user;
    setSessionState({ loading: false, user, isAuthenticated: true });
    _redirectToDashboard(user);
  }, [_redirectToDashboard]);

  // ---------------------------------------------------------------------------
  // Handle logout
  // ---------------------------------------------------------------------------
  const handleLogout = useCallback(async () => {
    // Flag explicit logout to prevent Firebase Auth listener from auto-logging back in
    try { sessionStorage.setItem('hss_explicit_logout', 'true'); } catch (_) {}

    // Fire and forget server logout so UI doesn't hang
    appsScriptApi.logout().catch(() => {});

    // Sign out from Firebase Auth
    try {
      if (auth?.currentUser) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn('Firebase signout note:', e);
    }
    
    sessionManager.clearSession();
    setSessionState({ loading: false, user: null, isAuthenticated: false });
    navigate('/portal/login', { replace: true });
  }, [navigate]);

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
      refreshSession: validateCurrentSession,
    }} />
  );
}
