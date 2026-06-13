import React from 'react';
import { Users, BookOpen, Award, Globe, Eye, Compass } from 'lucide-react';
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

        <div className="grid md:grid-cols-2 gap-8">
          {/* VISION CARD */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-250 bg-gradient-to-br from-white to-amber-50/30 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
            {/* Background Decorative Large Letter */}
            <div className="absolute right-4 bottom-[-10px] text-8xl font-black text-amber-500/10 select-none pointer-events-none group-hover:scale-110 transition-transform duration-500">
              V
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 group-hover:rotate-6 transition-transform duration-300">
                <Eye size={24} className="stroke-[2]" />
              </div>
              <div className="space-y-2.5">
                <h4 className="text-xl font-bold text-slate-800 tracking-wide">
                  Vision
                </h4>
                <div className="w-12 h-1 bg-amber-500 rounded-full" />
                <p className="text-slate-600 leading-relaxed text-sm md:text-[14.5px] font-medium">
                  To develop an institution that empowers a generation of leaders defined by academic excellence and a commitment to society.
                </p>
              </div>
            </div>
          </div>

          {/* MISSION CARD */}
          <div className="relative overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-white to-teal-50/30 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
            {/* Background Decorative Large Letter */}
            <div className="absolute right-4 bottom-[-10px] text-8xl font-black text-teal-500/10 select-none pointer-events-none group-hover:scale-110 transition-transform duration-500">
              M
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/20 group-hover:rotate-6 transition-transform duration-300">
                <Compass size={24} className="stroke-[2]" />
              </div>
              <div className="space-y-2.5">
                <h4 className="text-xl font-bold text-slate-800 tracking-wide">
                  Mission
                </h4>
                <div className="w-12 h-1 bg-teal-600 rounded-full" />
                <p className="text-slate-600 leading-relaxed text-sm md:text-[14.5px] font-medium">
                  To equip students with cutting-edge resources in Science and Humanities, cultivating the skills and character needed to lead in a complex world.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Values / Highlights */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h3 className="text-2xl font-bold text-slate-800 mb-8 text-center font-heading">Why Choose Govt. HSS Shangus?</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center flex flex-col items-center hover:shadow-md hover:-translate-y-1 hover:border-slate-200 transition-all duration-300 group">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 border border-teal-100/30 text-teal-600 mb-4 transition-transform duration-350 group-hover:scale-110">
              <Users size={20} className="stroke-[2.5]" />
            </div>
            <h4 className="font-bold text-slate-800 mb-2">Experienced Faculty</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Dedicated teachers focused on student growth and mentoring.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center flex flex-col items-center hover:shadow-md hover:-translate-y-1 hover:border-slate-200 transition-all duration-300 group">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 border border-teal-100/30 text-teal-600 mb-4 transition-transform duration-350 group-hover:scale-110">
              <BookOpen size={20} className="stroke-[2.5]" />
            </div>
            <h4 className="font-bold text-slate-800 mb-2">Modern Labs & Library</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Well-equipped Science labs and a curated resource library for learners.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center flex flex-col items-center hover:shadow-md hover:-translate-y-1 hover:border-slate-200 transition-all duration-300 group">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 border border-teal-100/30 text-teal-600 mb-4 transition-transform duration-350 group-hover:scale-110">
              <Award size={20} className="stroke-[2.5]" />
            </div>
            <h4 className="font-bold text-slate-800 mb-2">Strong Results</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Consistent academic outcomes and competitive exam performance.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center flex flex-col items-center hover:shadow-md hover:-translate-y-1 hover:border-slate-200 transition-all duration-300 group">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 border border-teal-100/30 text-teal-600 mb-4 transition-transform duration-350 group-hover:scale-110">
              <Globe size={20} className="stroke-[2.5]" />
            </div>
            <h4 className="font-bold text-slate-800 mb-2">Holistic Education</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Balanced focus on academics, sports, and values-based learning.</p>
          </div>
        </div>
      </div>

      {/* History / Timeline + CTA */}
      <div className="max-w-6xl mx-auto px-4 py-12 border-t border-slate-100">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div>
            <h3 className="text-2xl font-bold text-slate-800 mb-4 font-heading">Our Story</h3>
            <p className="text-slate-700 leading-relaxed text-sm">From modest beginnings to a premier local institution, Govt. HSS Shangus has steadily expanded its academic offerings and infrastructure to meet the needs of families across Anantnag. Our commitment to inclusion and quality has guided our growth.</p>
            
            <div className="relative pl-6 border-l-2 border-slate-200 space-y-6 mt-8">
              {[
                { year: '1917', title: 'Foundation', desc: 'School founded to serve local communities, establishing a legacy of learning in the valley.' },
                { year: '1971', title: 'Higher Secondary Upgrade', desc: 'Upgraded to a Higher Secondary institution, significantly expanding academic curricula.' },
                { year: '2000s', title: 'Infrastructure Expansion', desc: 'Modern laboratories, specialized smart classrooms, and a comprehensive library resource hub added.' }
              ].map((item, i) => (
                <div key={i} className="relative group">
                  {/* Timeline Dot */}
                  <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-teal-500 bg-white group-hover:bg-teal-500 transition-colors duration-250" />
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded bg-teal-50 border border-teal-100 text-teal-800 font-extrabold text-[10px] mb-1.5">{item.year}</span>
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/60 shadow-sm flex flex-col items-start gap-4">
            <h4 className="text-lg font-bold text-slate-800 font-heading">Get Involved</h4>
            <p className="text-xs text-slate-550 leading-relaxed">Admissions are open — join a community that values academic rigour and character formation.</p>
            <Link to="/admissions" className="btn-primary-custom px-6 py-2.5 rounded-full font-bold shadow-md transition-all duration-200 text-xs tracking-wide uppercase">Apply Now</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
