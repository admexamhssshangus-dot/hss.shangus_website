import React, { useState, useEffect, useRef } from 'react';
import { Users, Award, BookOpen, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

// 1. IMPORT YOUR LOCAL BACKGROUND IMAGE (Make sure the file is renamed to logo.png)
import Slideshow from '../components/Slideshow';

// Modern Counter Animation Component
const AnimatedCounter = ({ end, prefix = '', suffix = '' }) => {
  const [count, setCount] = useState(0);
  const elementRef = useRef(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    let animationFrameId = null;

    const startAnimation = () => {
      let startTime = null;
      const duration = 2000; // 2 seconds animation duration

      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Smooth ease-out animation formula
        const easeOut = 1 - Math.pow(1 - progress, 4);
        
        setCount(Math.floor(easeOut * end));

        if (progress < 1) {
          animationFrameId = window.requestAnimationFrame(animate);
        }
      };

      animationFrameId = window.requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Reset count and start animation when it enters viewport
          setCount(0);
          if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
          }
          startAnimation();
        } else {
          // Reset count when it goes out of view, so it animates again next time
          setCount(0);
          if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    return () => {
      observer.unobserve(el);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [end]);

  return <span ref={elementRef}>{prefix}{count}{suffix}</span>;
};

export default function Home() {
  return (
    <div className="w-full">
      <div className="hero-container relative w-full bg-slate-900 flex items-center justify-center text-center overflow-hidden">
        
        {/* Background slideshow: using `public/slides/slides.txt` mapping file */}
        <Slideshow configUrl="/slides/slides.txt" imageFolder="/slides/" interval={6000} />
        
        <div className="relative z-20 px-4">
          <h2
            className="text-[24px] sm:text-[31px] md:text-[48px] font-semibold mb-4 sm:mb-6 italic tracking-wider leading-tight sm:leading-snug font-slogan"
            style={{
              color: '#961c14',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.95), 0 0 20px rgba(255, 255, 255, 0.85), 0 0 35px rgba(255, 255, 255, 0.6), 0 2px 4px rgba(0, 0, 0, 0.5)'
            }}
          >
            nurturing minds,<br className="sm:hidden" /> shaping futures
          </h2>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-[6px] sm:space-y-0 sm:space-x-[6px]">
            <Link to="/admissions" className="px-3 py-1.5 sm:px-5 sm:py-2 font-bold rounded-md transition-all shadow-lg inline-block text-[12px] sm:text-[14px] btn-hero-primary">
              Admissions Open 2026
            </Link>
            <Link to="/about" className="px-[10px] py-[5px] sm:px-[14px] sm:py-[6px] font-bold rounded-md transition-all shadow-lg inline-block text-[10px] sm:text-[12px] btn-hero-secondary">
              Learn More
            </Link>
          </div>
        </div>
        
          {/* (Removed legacy bottom banner to avoid overlapping with slideshow captions) */}
      </div>

      {/* Main Content Area: Notices & Principal */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Notices Sidebar */}
        <div className="col-span-1">
          <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-teal-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">Latest Notices</h3>
              <span className="bg-teal-600 text-xs px-2 py-1 rounded">UPDATES</span>
            </div>
            <ul className="divide-y divide-slate-100 p-4">
              <li className="py-3 flex items-start">
                <span className="text-xs font-bold text-slate-400 mr-4 mt-1 w-12">Nov 23</span>
                <a href="#" className="text-sm font-medium hover:text-teal-700 hover:underline">JKBOSE Datesheet</a>
              </li>
              <li className="py-3 flex items-start">
                <span className="text-xs font-bold text-slate-400 mr-4 mt-1 w-12">Nov 23</span>
                <a href="#" className="text-sm font-medium hover:text-teal-700 hover:underline">PreBoard Results</a>
              </li>
              <li className="py-3 flex items-start">
                <span className="text-xs font-bold text-slate-400 mr-4 mt-1 w-12">Nov 23</span>
                <a href="#" className="text-sm font-medium hover:text-teal-700 hover:underline">Admit Cards</a>
              </li>
            </ul>
            <div className="bg-slate-50 p-3 text-center border-t border-slate-100">
              <a href="#" className="text-sm font-bold text-teal-800 hover:underline">View All Archives</a>
            </div>
          </div>
        </div>

        {/* Principal Message & Stats */}
        <div className="col-span-1 md:col-span-2">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 md:border-l-4 md:border-teal-800 md:pl-4 mb-6">Principal's Message</h2>
            <div className="flex flex-col sm:flex-row bg-white p-6 rounded-lg shadow-lg border-2 border-teal-100 items-center">
              <div className="w-32 h-32 flex-shrink-0 rounded-md overflow-hidden mx-auto mb-4 sm:mb-0 shadow-md" style={{ border: '2px solid #0ea5a3' }}>
                <img src="/slides/Principal.jpg" alt="Principal Mr. Aijaz Ahmad Wagay" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 lg:border-l-2 lg:border-teal-100 lg:pl-4 pl-0">
                <div className="bg-white p-4 rounded shadow-sm border border-slate-100">
                  <p className="text-slate-700 italic text-sm leading-relaxed">
                    "Welcome to <strong className="text-slate-800">Govt HSS Shangus</strong>. Our mandate is to <strong>empower leaders</strong> defined by <strong>academic excellence and ethics</strong>. We offer a learning environment where <strong>cutting-edge resources</strong> in <strong>Science and Humanities</strong> meet <strong>value-based education</strong> — equipping you with the skills to thrive and the character to lead in a global society."
                  </p>
                  <p className="text-right text-xs text-slate-500 mt-4">Mr. Aijaz Ahmad Wagay<br/>Principal, HSS Shangus</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row - NOW FEATURING ANIMATED COUNTERS! */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, end: 700, suffix: "+", label: "STUDENTS" },
              { icon: Award, end: 25, suffix: "+", label: "TEACHERS" },
              { icon: BookOpen, end: 22, suffix: "+", label: "SUBJECTS" },
              { icon: GraduationCap, end: 90, suffix: "%+", label: "RESULT" }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 text-center flex flex-col items-center justify-center">
                <h4 className="text-3xl font-bold text-teal-700">
                  <AnimatedCounter end={stat.end} prefix={stat.prefix} suffix={stat.suffix} />
                </h4>
                <p className="text-xs font-bold text-slate-500 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

