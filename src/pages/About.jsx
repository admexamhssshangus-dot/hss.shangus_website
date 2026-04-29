import React from 'react';

export default function About() {
  // To use a local background image, add a file under `src/images` (eg. `about-bg.jpg`) and
  // uncomment the import below then set `aboutBg` to the imported variable.
  // Example:
  // import aboutBgLocal from '../images/about-bg.jpg'
  // const aboutBg = aboutBgLocal
  const aboutBg = 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1920&q=80';
  return (
    <div className="w-full mb-20">
      {/* Hero */}
      <div className="relative h-[320px] sm:h-[400px] w-full bg-slate-900 flex items-center justify-center text-center">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${aboutBg})` }}
        ></div>
        {/* ADDED: Dark overlay to ensure white text has high contrast */}
        <div className="absolute inset-0 bg-black/50"></div>
        
        <div className="relative z-10 px-4 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">About Our Institution</h2>
          <h3 className="text-xl sm:text-2xl font-semibold text-slate-200 mb-6">A Beacon of Knowledge</h3>
          <p className="text-slate-100 text-sm md:text-base leading-relaxed">
            Government Higher Secondary School Shangus has been a beacon of knowledge in the Anantnag district for decades. Our mission is to foster an environment where every student is encouraged to explore their potential. We believe in a holistic approach to education that goes beyond textbooks.
          </p>
        </div>
      </div>

      {/* Vision & Mission */}
      <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-8 relative -mt-16 z-20">
        <div className="bg-white rounded-xl shadow-xl p-8 border-t-4 border-teal-500">
          <h3 className="text-2xl font-bold text-teal-800 mb-4">Our Vision</h3>
          <p className="text-slate-600 italic">
            <strong>Empowering</strong> a generation of leaders defined by academic excellence and a commitment to society.
          </p>
        </div>
        <div className="bg-blue-50/90 rounded-xl shadow-xl p-8 border-t-4 border-blue-500">
          <h3 className="text-2xl font-bold text-blue-900 mb-4">Our Mission</h3>
          <p className="text-slate-700 italic">
            To <strong>equip</strong> students with cutting-edge resources in Science and Humanities, <strong>cultivating the skills and character needed to lead in a complex world.</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
