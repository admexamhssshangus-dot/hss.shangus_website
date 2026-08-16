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
// Lazy-loaded pages — code-split to reduce initial bundle size.
// ---------------------------------------------------------------------------
const About = lazy(() => import('./pages/About'));
const Academics = lazy(() => import('./pages/Academics'));
const Admissions = lazy(() => import('./pages/Admissions'));
const NoticeBoard = lazy(() => import('./pages/NoticeBoard'));
const DynamicPage = lazy(() => import('./pages/DynamicPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const LoginPortal = lazy(() => import('./pages/LoginPortal'));
const StudentVerificationPage = lazy(() => import('./pages/StudentVerificationPage'));
const PortalLayout = lazy(() => import('./portal/layout/PortalLayout'));
const LoginPage = lazy(() => import('./portal/LoginPage'));
const RegisterPage = lazy(() => import('./portal/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./portal/ForgotPasswordPage'));
const AuthActionPage = lazy(() => import('./portal/AuthActionPage'));
const StudentDashboard = lazy(() => import('./portal/student/StudentDashboard'));
const AdmissionForm = lazy(() => import('./portal/student/AdmissionForm'));
const TeacherDashboard = lazy(() => import('./portal/teacher/TeacherDashboard'));
const AttendancePage = lazy(() => import('./portal/teacher/AttendancePage'));
const PracticalsPage = lazy(() => import('./portal/teacher/PracticalsPage'));
const AdminDashboard = lazy(() => import('./portal/admin/AdminDashboard'));

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
const ROLE_REDIRECT = {
  student: '/portal/student',
  teacher: '/portal/teacher',
  faculty: '/portal/teacher',
  admin: '/portal/admin',
  superadmin: '/portal/admin',
  'super admin': '/portal/admin',
};

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
