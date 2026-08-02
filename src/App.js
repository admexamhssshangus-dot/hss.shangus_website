import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ThemeSelector from './components/ThemeSelector';
import Home from './pages/Home';
import About from './pages/About';
import Academics from './pages/Academics';
import Admissions from './pages/Admissions';
import AdminMessages from './pages/AdminMessages';
import AdminPortal from './pages/AdminPortal';
import NoticeBoard from './pages/NoticeBoard';
import DynamicPage from './pages/DynamicPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import RefundPolicy from './pages/RefundPolicy';
import ContactUs from './pages/ContactUs';
import LoginPortal from './pages/LoginPortal';
import { initSecurityGuardrails } from './utils/securityGuardrails';

// Portal imports
import './portal/portal.css';
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
