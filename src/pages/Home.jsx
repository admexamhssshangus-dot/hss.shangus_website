import React, { useState, useEffect } from 'react';
import { Users, Award, BookOpen, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

// 1. IMPORT YOUR LOCAL BACKGROUND IMAGE (Make sure the file is renamed to logo.png)
import Slideshow from '../components/Slideshow';

// Modern Counter Animation Component
const AnimatedCounter = ({ end, prefix = '', suffix = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    const duration = 2000; // 2 seconds animation duration

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Smooth ease-out animation formula
      const easeOut = 1 - Math.pow(1 - progress, 4);
      
      setCount(Math.floor(easeOut * end));

      if (progress < 1) {
        window.requestAnimationFrame(animate);
      }
    };

    window.requestAnimationFrame(animate);
  }, [end]);

  return <span>{prefix}{count}{suffix}</span>;
};

export default function Home() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <div className="relative h-[500px] w-full bg-slate-900 flex items-center justify-center text-center">
        
        {/* Background slideshow: using `public/slides/slides.txt` mapping file */}
        <Slideshow configUrl="/slides/slides.txt" imageFolder="/slides/" interval={6000} />
        
        <div className="relative z-20 px-4">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg italic tracking-wider">
            nurturing minds, <span className="text-red-400">shaping futures</span>
          </h2>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-3 sm:space-y-0 sm:space-x-3">
            <Link to="/admissions" className="px-6 py-2 sm:px-8 sm:py-3 bg-teal-700 text-white font-bold rounded-md hover:bg-teal-600 transition-colors shadow-lg inline-block text-sm sm:text-base">
              Admissions Open 2025
            </Link>
            <Link to="/about" className="px-6 py-2 sm:px-8 sm:py-3 bg-slate-900 text-white font-bold rounded-md hover:bg-slate-800 border border-slate-700 transition-colors shadow-lg inline-block text-sm sm:text-base">
              Learn More
            </Link>
          </div>
        </div>
        
        {/* Bottom Banner from screenshot */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-6 text-left">
           <h3 className="text-2xl font-bold text-teal-300">Playground</h3>
           <p className="text-white italic">where students engage in physical activities</p>
        </div>
      </div>

      {/* Main Content Area: Notices & Principal */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        
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
                <a href="#" className="text-sm font-medium hover:text-teal-700 hover:underline">jkbose datesheet</a>
              </li>
              <li className="py-3 flex items-start">
                <span className="text-xs font-bold text-slate-400 mr-4 mt-1 w-12">Nov 23</span>
                <a href="#" className="text-sm font-medium hover:text-teal-700 hover:underline">PreBoard Results</a>
              </li>
              <li className="py-3 flex items-start">
                <span className="text-xs font-bold text-slate-400 mr-4 mt-1 w-12">Nov 23</span>
                <a href="#" className="text-sm font-medium hover:text-teal-700 hover:underline">admit cards</a>
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
            <h2 className="text-2xl font-bold text-slate-800 border-l-4 border-teal-800 pl-4 mb-6">Principal's Message</h2>
            <div className="flex flex-col sm:flex-row bg-white p-6 rounded-lg shadow-sm border border-slate-100 items-start">
              <div className="w-32 h-32 flex-shrink-0 bg-slate-200 rounded-lg overflow-hidden border-2 border-slate-300 mr-6 mb-4 sm:mb-0 shadow-md">
                {/* Note: You can import a local principal image just like the background image and place the variable in the src={} below! */}
                <img src="[https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80](https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80)" alt="Principal" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-slate-600 italic text-sm leading-relaxed">
                  "Welcome to <strong className="text-slate-800">Govt HSS Shangus</strong>.<br/><br/>
                  Our mandate is to <strong>empower leaders</strong> defined by <strong>academic excellence and ethics</strong>. We offer a learning environment where <strong>cutting-edge resources</strong> in <strong>Science and Humanities</strong> meet <strong>value-based education</strong> — equipping you with the <strong>skills to thrive</strong> and the <strong>character to lead</strong> in a global society."
                </p>
                <p className="text-right text-xs text-slate-500 mt-4">Mr. Principal Name<br/>Principal, HSS Shangus</p>
              </div>
            </div>
          </div>

          {/* Stats Row - NOW FEATURING ANIMATED COUNTERS! */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, end: 700, suffix: "+", label: "STUDENTS" },
              { icon: Award, end: 25, suffix: "+", label: "TEACHERS" },
              { icon: BookOpen, end: 22, suffix: "+", label: "SUBJECTS" },
              { icon: GraduationCap, end: 90, prefix: ">", suffix: "%", label: "RESULT" }
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

