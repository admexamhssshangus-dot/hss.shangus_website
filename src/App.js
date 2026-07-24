import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
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
        
        {/* Main Content Area (padding is based on measured header height) */}
        <main className="flex-grow" style={{ paddingTop: 'var(--site-header-height, 64px)' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/academics" element={<Academics />} />
            <Route path="/admissions" element={<Admissions />} />
            <Route path="/login" element={<LoginPortal />} />
            <Route path="/portal" element={<LoginPortal />} />
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


