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

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
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
            <Route path="/notices" element={<NoticeBoard />} />
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


