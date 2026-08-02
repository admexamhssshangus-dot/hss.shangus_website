import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ThemeSelector from './components/ThemeSelector';
import Home from './pages/Home';
import { initSecurityGuardrails } from './utils/securityGuardrails';
import './portal/portal.css';

// ---------------------------------------------------------------------------
// Lazy-loaded pages — code-split to reduce initial bundle size.
// Homepage visitors download ONLY the homepage chunk (~400KB).
// Portal routes load on-demand when navigated to.
// ---------------------------------------------------------------------------
const About = lazy(() => import('./pages/About'));
const Academics = lazy(() => import('./pages/Academics'));
const Admissions = lazy(() => import('./pages/Admissions'));
const AdminMessages = lazy(() => import('./pages/AdminMessages'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));
const NoticeBoard = lazy(() => import('./pages/NoticeBoard'));
const DynamicPage = lazy(() => import('./pages/DynamicPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const LoginPortal = lazy(() => import('./pages/LoginPortal'));

// Portal lazy-loaded components
const PortalLayout = lazy(() => import('./portal/layout/PortalLayout'));
const LoginPage = lazy(() => import('./portal/LoginPage'));
const RegisterPage = lazy(() => import('./portal/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./portal/ForgotPasswordPage'));
const StudentDashboard = lazy(() => import('./portal/student/StudentDashboard'));
const AdmissionForm = lazy(() => import('./portal/student/AdmissionForm'));
const TeacherDashboard = lazy(() => import('./portal/teacher/TeacherDashboard'));
const AttendancePage = lazy(() => import('./portal/teacher/AttendancePage'));
const PracticalsPage = lazy(() => import('./portal/teacher/PracticalsPage'));
const AdminDashboard = lazy(() => import('./portal/admin/AdminDashboard'));

// Suspense fallback for lazy-loaded routes
const LazyFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
    <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#14b8a6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

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

  const role = (user.role || '').toLowerCase().trim();

  // Determine if this role is in the allowed list (using normalized role map)
  const allowed = allowedRoles.some((r) => {
    if (r === 'admin') return ['admin', 'superadmin', 'super admin'].includes(role);
    if (r === 'teacher') return ['teacher', 'faculty'].includes(role);
    if (r === 'student') return role === 'student';
    return role === r;
  });

  if (!allowed) {
    // Redirect the user to their own dashboard, not to login
    const dest = ROLE_REDIRECT[role] || '/portal/login';
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
    <BrowserRouter>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen">
        {/* The Navbar will always show on every page */}
        <Navbar /> 
        
        {/* Main Content Area */}
        <main className="flex-grow flex flex-col" style={{ paddingTop: 'var(--site-header-height, 64px)', backgroundColor: 'var(--bg-page, #f5f3ff)' }}>
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
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/portal" element={<AdminPortal />} />

            {/* ─── React Portal Routes ─── */}
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<LoginPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />

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

            <Route path="/:pageId" element={<DynamicPage />} />
          </Routes>
          </Suspense>
        </main>

        {/* The Footer will always show at the bottom */}
        <Footer />
        
        {/* Floating Theme Selector Toggle */}
        <ThemeSelector />
      </div>
    </BrowserRouter>
  );
}

export default App;
