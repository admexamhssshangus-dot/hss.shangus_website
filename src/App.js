import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ThemeSelector from './components/ThemeSelector';
import PublicPageSkeleton from './components/PublicPageSkeleton';
import Home from './pages/Home';
import GkTestRegistration from './pages/GkTestRegistration';
import { initSecurityGuardrails } from './utils/securityGuardrails';
import './portal/portal.css';
import './styles/ui-system.css';

// Core Portal components — statically imported for 100% render reliability & instant navigation

// ---------------------------------------------------------------------------
// Lazy-loaded pages — code-split to reduce initial bundle size. During a new
// deployment or local hot-reload the browser can briefly retain an obsolete
// chunk filename. Reload once to obtain the current asset manifest, then surface
// a genuine error if the new chunk still cannot be loaded.
// ---------------------------------------------------------------------------
const lazyWithChunkRecovery = (importer, chunkKey) => lazy(async () => {
  const retryKey = `hss_chunk_retry_${chunkKey}`;
  try {
    const module = await importer();
    try { sessionStorage.removeItem(retryKey); } catch (_) {}
    return module;
  } catch (error) {
    const message = String(error?.message || error || '');
    const isChunkFailure = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(message);
    let alreadyRetried = false;
    try { alreadyRetried = sessionStorage.getItem(retryKey) === '1'; } catch (_) {}
    if (isChunkFailure && !alreadyRetried && typeof window !== 'undefined') {
      try { sessionStorage.setItem(retryKey, '1'); } catch (_) {}
      window.location.reload();
      return new Promise(() => {});
    }
    throw error;
  }
});

const About = lazyWithChunkRecovery(() => import('./pages/About'), 'about');
const Academics = lazyWithChunkRecovery(() => import('./pages/Academics'), 'academics');
const Admissions = lazyWithChunkRecovery(() => import('./pages/Admissions'), 'admissions');
const NoticeBoard = lazyWithChunkRecovery(() => import('./pages/NoticeBoard'), 'notices');
const DynamicPage = lazyWithChunkRecovery(() => import('./pages/DynamicPage'), 'dynamic');
const PrivacyPolicy = lazyWithChunkRecovery(() => import('./pages/PrivacyPolicy'), 'privacy');
const TermsAndConditions = lazyWithChunkRecovery(() => import('./pages/TermsAndConditions'), 'terms');
const RefundPolicy = lazyWithChunkRecovery(() => import('./pages/RefundPolicy'), 'refund');
const ContactUs = lazyWithChunkRecovery(() => import('./pages/ContactUs'), 'contact');
const LoginPortal = lazyWithChunkRecovery(() => import('./pages/LoginPortal'), 'public-login');
const StudentVerificationPage = lazyWithChunkRecovery(() => import('./pages/StudentVerificationPage'), 'verification');
const PortalLayout = lazyWithChunkRecovery(() => import('./portal/layout/PortalLayout'), 'portal-layout');
const LoginPage = lazyWithChunkRecovery(() => import('./portal/LoginPage'), 'portal-login');
const RegisterPage = lazyWithChunkRecovery(() => import('./portal/RegisterPage'), 'register');
const ForgotPasswordPage = lazyWithChunkRecovery(() => import('./portal/ForgotPasswordPage'), 'forgot-password');
const AuthActionPage = lazyWithChunkRecovery(() => import('./portal/AuthActionPage'), 'auth-action');
const StudentDashboard = lazyWithChunkRecovery(() => import('./portal/student/StudentDashboard'), 'student-dashboard');
const AdmissionForm = lazyWithChunkRecovery(() => import('./portal/student/AdmissionForm'), 'admission-form');
const TeacherDashboard = lazyWithChunkRecovery(() => import('./portal/teacher/TeacherDashboard'), 'teacher-dashboard');
const AttendancePage = lazyWithChunkRecovery(() => import('./portal/teacher/AttendancePage'), 'attendance');
const PracticalsPage = lazyWithChunkRecovery(() => import('./portal/teacher/PracticalsPage'), 'practicals');
const AdminDashboard = lazyWithChunkRecovery(() => import('./portal/admin/AdminDashboard'), 'admin-dashboard');

// A stable, responsive placeholder while route bundles are downloaded.
const LazyFallback = () => <PublicPageSkeleton label="Loading page…" />;

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// ---------------------------------------------------------------------------
// RoleGuard — protects portal sub-routes based on authenticated user role.
// Reads the session from PortalLayout's Outlet context.
// If the user's role doesn't match, they are redirected to their own dashboard.
// ---------------------------------------------------------------------------
function RoleGuard({ allowedRoles, children }) {
  const { user, isAuthenticated } = useOutletContext();

  if (!isAuthenticated || !user) {
    return <Navigate to="/portal/login" replace />;
  }

  const role = String(user.role || '').toLowerCase().trim();

  // Flexible role matching to prevent flash on hard refresh
  const allowed = allowedRoles.some((r) => {
    const normR = String(r).toLowerCase().trim();
    if (normR === 'admin') return role.includes('admin');
    if (normR === 'teacher') return role.includes('teacher') || role.includes('faculty');
    if (normR === 'student') return role.includes('student') || role === 'user';
    return role === normR;
  });

  if (!allowed) {
    const dest = role.includes('admin') ? '/portal/admin' : role.includes('teacher') ? '/portal/teacher' : '/portal/student';
    return <Navigate to={dest} replace />;
  }

  return children;
}


function App() {
  useEffect(() => {
    const cleanup = initSecurityGuardrails();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return (
    <>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen w-full max-w-full">
        <a className="ui-skip-link" href="#main-content">Skip to main content</a>
        {/* The Navbar will always show on every page */}
        <Navbar /> 
        
        {/* Main Content Area */}
        <main id="main-content" tabIndex="-1" className="flex-grow flex flex-col w-full max-w-full" style={{ paddingTop: 'var(--site-header-height, 64px)', backgroundColor: 'var(--bg-page, #f5f3ff)' }}>
          <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/academics" element={<Academics />} />
            <Route path="/admissions" element={<Admissions />} />
            <Route path="/login" element={<LoginPortal />} />
            <Route path="/notices" element={<NoticeBoard />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/refund-and-cancellation-policy" element={<RefundPolicy />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/admin/messages" element={<Navigate to="/portal/login" replace />} />
            <Route path="/admin/portal" element={<Navigate to="/portal/admin?tab=cms" replace />} />
            <Route path="/verify-student" element={<StudentVerificationPage />} />
            <Route path="/verify" element={<StudentVerificationPage />} />

            {/* ─── React Portal Routes ─── */}
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<LoginPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="auth/action" element={<AuthActionPage />} />

              {/* Student-only routes */}
              <Route path="student" element={<RoleGuard allowedRoles={['student']}><StudentDashboard /></RoleGuard>} />
              <Route path="student/application" element={<RoleGuard allowedRoles={['student']}><AdmissionForm /></RoleGuard>} />

              {/* Teacher-only routes */}
              <Route path="teacher" element={<RoleGuard allowedRoles={['teacher']}><TeacherDashboard /></RoleGuard>} />
              <Route path="teacher/attendance" element={<RoleGuard allowedRoles={['teacher']}><AttendancePage /></RoleGuard>} />
              <Route path="teacher/practicals" element={<RoleGuard allowedRoles={['teacher']}><PracticalsPage /></RoleGuard>} />

              {/* Admin-only routes (SuperAdmin is also allowed) */}
              <Route path="admin" element={<RoleGuard allowedRoles={['admin']}><AdminDashboard /></RoleGuard>} />
            </Route>

            <Route path="/gk-test" element={<GkTestRegistration />} />
            <Route path="/:pageId" element={<DynamicPage />} />
          </Routes>
          </Suspense>
        </main>

        {/* The Footer will always show at the bottom */}
        <Footer />
        
        {/* Floating Theme Selector Toggle */}
        <ThemeSelector />
      </div>
    </>
  );
}

export default App;
