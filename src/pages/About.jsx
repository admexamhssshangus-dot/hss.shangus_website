import React from 'react';
import { Users, BookOpen, Award, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function About() {
  // To use a local background image, add a file under `src/images` (eg. `about-bg.jpg`) and
  // uncomment the import below then set `aboutBg` to the imported variable.
  // Example:
  // import aboutBgLocal from '../images/about-bg.jpg'
  // const aboutBg = aboutBgLocal
  const aboutBg = '/slides/aboutus.jpg';
  return (
    <div className="w-full mb-20">
      <SEO title="About Us & Institution" description="Discover the history, vision, mission, and principal's message of Govt. Higher Secondary School Shangus in Anantnag. Meet our faculty and explore our campus legacy." />
      {/* Hero */}
      <div className="relative h-[304px] sm:h-[378px] w-full bg-slate-900 flex items-center justify-center text-center">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${aboutBg})` }}
        ></div>
        {/* ADDED: Dark overlay to ensure white text has high contrast */}
        <div className="absolute inset-0 bg-black/50"></div>
        
        <div className="relative z-10 px-4 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">About Our Institution</h2>
          <h3 className="text-xl sm:text-2xl font-semibold text-slate-200 mb-6">A Beacon of Knowledge</h3>
          <p className="text-slate-100 text-sm md:text-base leading-relaxed">Serving the Anantnag district with a long tradition of academic excellence and holistic student development.</p>
        </div>
      </div>

      {/* Glimpse + Vision & Mission (moved prospectus content) */}
      <div className="max-w-6xl mx-auto px-4 py-12 relative -mt-16 z-20">
        <div className="bg-white rounded-xl shadow-xl p-8 border-t-4 border-teal-500 mb-8">
          <h3 className="text-2xl font-bold text-teal-800 mb-4">Glimpse of the Institution</h3>
          <p className="text-slate-700 leading-relaxed">A haven of learning in the heart of the Kashmir Valley, Govt. Higher Secondary School (HSS) Shangus provides a vibrant educational environment surrounded by lush greenery. Established in 1917, the school has a long tradition of academic excellence, modern facilities, and a commitment to holistic development through curricular and co-curricular activities.</p>
          <p className="text-slate-700 leading-relaxed mt-3">Our campus offers spacious classrooms, well-equipped laboratories, a comprehensive library, and opportunities for sports and cultural activities. We focus on nurturing critical thinking, leadership skills, and ethical values in every student.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-teal-500">
            <h4 className="text-xl font-bold text-slate-800 mb-2">Vision</h4>
            <p className="text-slate-700">To develop an institution that empowers a generation of leaders defined by academic excellence and a commitment to society.</p>
          </div>
          <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-teal-500">
            <h4 className="text-xl font-bold text-slate-800 mb-2">Mission</h4>
            <p className="text-slate-700">To equip students with cutting-edge resources in Science and Humanities, cultivating the skills and character needed to lead in a complex world.</p>
          </div>
        </div>
      
      {/* Values / Highlights */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Why Choose Govt. HSS Shangus?</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-md text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 text-teal-600 mb-3">
              <Users size={20} />
            </div>
            <h4 className="font-semibold">Experienced Faculty</h4>
            <p className="text-sm text-slate-500 mt-2">Dedicated teachers focused on student growth and mentoring.</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 text-teal-600 mb-3">
              <BookOpen size={20} />
            </div>
            <h4 className="font-semibold">Modern Labs & Library</h4>
            <p className="text-sm text-slate-500 mt-2">Well-equipped Science labs and a curated resource library for learners.</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 text-teal-600 mb-3">
              <Award size={20} />
            </div>
            <h4 className="font-semibold">Strong Results</h4>
            <p className="text-sm text-slate-500 mt-2">Consistent academic outcomes and competitive exam performance.</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 text-teal-600 mb-3">
              <Globe size={20} />
            </div>
            <h4 className="font-semibold">Holistic Education</h4>
            <p className="text-sm text-slate-500 mt-2">Balanced focus on academics, sports, and values-based learning.</p>
          </div>
        </div>
      </div>

      {/* History / Timeline + CTA */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div>
            <h3 className="text-2xl font-bold text-slate-800 mb-4">Our Story</h3>
            <p className="text-slate-700 leading-relaxed mb-4">From modest beginnings to a premier local institution, Govt. HSS Shangus has steadily expanded its academic offerings and infrastructure to meet the needs of families across Anantnag. Our commitment to inclusion and quality has guided our growth.</p>
            <ul className="space-y-3 text-sm text-slate-600">
              <li><strong className="text-teal-700">1917:</strong> School founded to serve local communities.</li>
              <li><strong className="text-teal-700">1971:</strong> Upgraded to Higher Secondary with expanded curriculum.</li>
              <li><strong className="text-teal-700">2000s:</strong> Modern labs and library added.</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
            <h4 className="text-lg font-semibold mb-3">Get Involved</h4>
            <p className="text-sm text-slate-600 mb-4">Admissions are open — join a community that values academic rigour and character formation.</p>
            <Link to="/admissions" className="inline-block btn-primary-custom px-5 py-2 rounded-full font-semibold shadow transition-all duration-200">Apply Now</Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
