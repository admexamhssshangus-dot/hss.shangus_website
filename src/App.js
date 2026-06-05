import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Academics from './pages/Academics';
import Admissions from './pages/Admissions';
import AdminMessages from './pages/AdminMessages';

function App() {
  return (
    <BrowserRouter>
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
            <Route path="/admin/messages" element={<AdminMessages />} />
          </Routes>
        </main>

        {/* The Footer will always show at the bottom */}
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;

