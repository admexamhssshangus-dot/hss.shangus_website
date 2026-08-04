import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ThemeSelector from './components/ThemeSelector';
import Home from './pages/Home';
import GkTestRegistration from './pages/GkTestRegistration';
import { initSecurityGuardrails } from './utils/securityGuardrails';
import './portal/portal.css';

// Core Portal components — statically imported for 100% render reliability & instant navigation
import PortalLayout from './portal/layout/PortalLayout';
import LoginPage from './portal/LoginPage';
import RegisterPage from './portal/RegisterPage';
import ForgotPasswordPage from './portal/ForgotPasswordPage';
import StudentDashboard from './portal/student/StudentDashboard';
import AdmissionForm from './portal/student/AdmissionForm';
import TeacherDashboard from './portal/teacher/TeacherDashboard';
import AttendancePage from './portal/teacher/AttendancePage';
import PracticalsPage from './portal/teacher/PracticalsPage';
import AdminDashboard from './portal/admin/AdminDashboard';

// ---------------------------------------------------------------------------
// Lazy-loaded pages — code-split to reduce initial bundle size.
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
    <BrowserRouter>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen w-full max-w-full overflow-x-hidden">
        {/* The Navbar will always show on every page */}
        <Navbar /> 
        
        {/* Main Content Area */}
        <main className="flex-grow flex flex-col w-full max-w-full overflow-x-hidden" style={{ paddingTop: 'var(--site-header-height, 64px)', backgroundColor: 'var(--bg-page, #f5f3ff)' }}>
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
    </BrowserRouter>
  );
}

export default App;
