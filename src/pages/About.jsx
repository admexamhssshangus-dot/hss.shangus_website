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
        <div className="bg-white rounded-xl shadow-xl p-8 border-t-4 border-teal-500 mb-8 relative overflow-hidden">
          {/* Large decorative chinar leaf watermark for the whole card */}
          <svg className="absolute -right-12 -top-8 w-64 h-64 text-teal-500/[0.04] pointer-events-none select-none" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M100 10 C95 30, 70 35, 50 25 C60 50, 55 70, 30 80 C55 85, 65 95, 60 120 C75 105, 90 100, 100 110 C110 100, 125 105, 140 120 C135 95, 145 85, 170 80 C145 70, 140 50, 150 25 C130 35, 105 30, 100 10Z M100 110 L100 190" strokeWidth="3" stroke="currentColor" fillOpacity="0.5"/>
          </svg>
          <svg className="absolute -left-10 bottom-0 w-48 h-48 text-teal-500/[0.03] pointer-events-none select-none rotate-45" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M100 10 C95 30, 70 35, 50 25 C60 50, 55 70, 30 80 C55 85, 65 95, 60 120 C75 105, 90 100, 100 110 C110 100, 125 105, 140 120 C135 95, 145 85, 170 80 C145 70, 140 50, 150 25 C130 35, 105 30, 100 10Z M100 110 L100 190" strokeWidth="3" stroke="currentColor" fillOpacity="0.5"/>
          </svg>

          <h3 className="text-2xl font-bold text-teal-800 mb-6 relative z-10">Glimpse of the Institution</h3>

          {/* A Haven of Learning */}
          <div className="mb-6 relative overflow-hidden rounded-lg p-4 bg-gradient-to-r from-teal-50/30 to-transparent">
            {/* Chinar leaf – right side */}
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-28 h-28 text-teal-600/[0.06] pointer-events-none select-none" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M100 10 C95 30, 70 35, 50 25 C60 50, 55 70, 30 80 C55 85, 65 95, 60 120 C75 105, 90 100, 100 110 C110 100, 125 105, 140 120 C135 95, 145 85, 170 80 C145 70, 140 50, 150 25 C130 35, 105 30, 100 10Z M100 110 L100 190" strokeWidth="3" stroke="currentColor" fillOpacity="0.5"/>
            </svg>
            <h4 className="text-base font-bold text-slate-900 mb-2 relative z-10">A Haven of Learning in the Heart of the Kashmir Valley</h4>
            <p className="text-slate-700 leading-relaxed text-[14.5px] relative z-10">
              Nestled amidst the breathtaking mountains of the Kashmir Valley, <strong className="text-teal-800">Govt. Higher Secondary School (HSS) Shangus</strong> Anantnag is a vibrant educational institution renowned for its scenic location and commitment to academic excellence. The school's expansive campus, surrounded by lush greenery and the calming presence of the Shangus Forest Lodge, offers a serene and inspiring learning environment. Adorned by neighboring institutions like the esteemed Govt. Girls High School Shangus, Sub District Hospital Shangus, and the fire services garrison, HSS Shangus stands as a symbol of community and collaboration within the greater Shangus area.
            </p>
          </div>

          {/* A Legacy of Education Since 1917 */}
          <div className="mb-6 relative overflow-hidden rounded-lg p-4 bg-gradient-to-l from-amber-50/30 to-transparent">
            {/* Chinar leaf – left side, rotated */}
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-28 h-28 text-amber-600/[0.06] pointer-events-none select-none -rotate-12" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M100 10 C95 30, 70 35, 50 25 C60 50, 55 70, 30 80 C55 85, 65 95, 60 120 C75 105, 90 100, 100 110 C110 100, 125 105, 140 120 C135 95, 145 85, 170 80 C145 70, 140 50, 150 25 C130 35, 105 30, 100 10Z M100 110 L100 190" strokeWidth="3" stroke="currentColor" fillOpacity="0.5"/>
            </svg>
            <h4 className="text-base font-bold text-slate-900 mb-2 relative z-10">A Legacy of Education Since 1917</h4>
            <p className="text-slate-700 leading-relaxed text-[14.5px] relative z-10">
              Established in 1917 as a primary school, HSS Shangus boasts a rich history of serving the educational needs of the region. Its steady progression, with upgrades in 1978–79 and the achievement of Higher Secondary status in 2005, reflects the school's enduring commitment to providing quality instruction to generations of students. Our dedicated faculty, comprised of experienced educators, distinguished scholars, exceptional technocrats, and skilled professionals, fosters a stimulating academic environment for learners of all backgrounds.
            </p>
          </div>

          {/* Excellence in Academics and Beyond */}
          <div className="mb-6 relative overflow-hidden rounded-lg p-4 bg-gradient-to-r from-teal-50/30 to-transparent">
            {/* Chinar leaf – right side */}
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-28 h-28 text-teal-600/[0.06] pointer-events-none select-none rotate-12" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M100 10 C95 30, 70 35, 50 25 C60 50, 55 70, 30 80 C55 85, 65 95, 60 120 C75 105, 90 100, 100 110 C110 100, 125 105, 140 120 C135 95, 145 85, 170 80 C145 70, 140 50, 150 25 C130 35, 105 30, 100 10Z M100 110 L100 190" strokeWidth="3" stroke="currentColor" fillOpacity="0.5"/>
            </svg>
            <h4 className="text-base font-bold text-slate-900 mb-2 relative z-10">Excellence in Academics and Beyond</h4>
            <p className="text-slate-700 leading-relaxed text-[14.5px] relative z-10">
              HSS Shangus proudly serves a wide catchment area, attracting students from Kachwan to Uttresoo and beyond due to its reputation for exceptional teaching. Our consistent record of strong student performance, with numerous distinctions earned in both 10th and 12th class examinations, stands as a testament to the school's focus on academic rigor. Beyond the classroom, we nurture well-rounded individuals by providing enriching extracurricular activities, fostering leadership opportunities, and emphasizing the development of essential life skills. Our modern facilities, including spacious classrooms, well-equipped laboratories, and a comprehensive library, create a dynamic environment where students can explore their interests and reach their full potential.
            </p>
          </div>

          {/* Shaping Tomorrow's Leaders */}
          <div className="mb-6 relative overflow-hidden rounded-lg p-4 bg-gradient-to-l from-amber-50/30 to-transparent">
            {/* Chinar leaf – left side */}
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-28 h-28 text-amber-600/[0.06] pointer-events-none select-none rotate-[20deg]" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M100 10 C95 30, 70 35, 50 25 C60 50, 55 70, 30 80 C55 85, 65 95, 60 120 C75 105, 90 100, 100 110 C110 100, 125 105, 140 120 C135 95, 145 85, 170 80 C145 70, 140 50, 150 25 C130 35, 105 30, 100 10Z M100 110 L100 190" strokeWidth="3" stroke="currentColor" fillOpacity="0.5"/>
            </svg>
            <h4 className="text-base font-bold text-slate-900 mb-2 relative z-10">Shaping Tomorrow's Leaders</h4>
            <p className="text-slate-700 leading-relaxed text-[14.5px] relative z-10">
              At HSS Shangus, we ignite a passion for lifelong learning and instill a strong sense of responsibility within our students. Our faculty employs innovative teaching methods, emphasizing both the acquisition of knowledge and the development of critical thinking abilities. We are deeply committed to preparing our students not only for academic success but also to become engaged citizens who make meaningful contributions to their communities and the world.
            </p>
          </div>

          {/* CTA */}
          <div className="pt-4 border-t border-slate-200 relative z-10">
            <h4 className="text-sm font-bold text-teal-700 mb-1">Explore, Discover, Connect</h4>
            <p className="text-slate-600 text-[13.5px] leading-relaxed">Tour our vibrant campus, explore our curriculum, and connect with our admissions team to learn more!</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* VISION CARD */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white bg-gradient-to-br from-white to-amber-50/40 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
            {/* Background Decorative Large Letter */}
            <div className="absolute right-4 bottom-[-10px] text-8xl font-black text-amber-500/10 select-none pointer-events-none group-hover:scale-110 transition-transform duration-500">
              V
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 group-hover:rotate-6 transition-transform duration-300">
                <Eye size={24} className="stroke-[2]" />
              </div>
              <div className="space-y-2.5">
                <h4 className="text-xl font-bold text-slate-900 tracking-wide">
                  Vision
                </h4>
                <div className="w-12 h-1 bg-amber-500 rounded-full" />
                <p className="text-slate-800 leading-relaxed text-sm md:text-[14.5px] font-medium">
                  To develop an institution that empowers a generation of leaders defined by academic excellence and a commitment to society.
                </p>
              </div>
            </div>
          </div>

          {/* MISSION CARD */}
          <div className="relative overflow-hidden rounded-2xl border border-teal-200 bg-white bg-gradient-to-br from-white to-teal-50/40 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
            {/* Background Decorative Large Letter */}
            <div className="absolute right-4 bottom-[-10px] text-8xl font-black text-teal-500/10 select-none pointer-events-none group-hover:scale-110 transition-transform duration-500">
              M
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/20 group-hover:rotate-6 transition-transform duration-300">
                <Compass size={24} className="stroke-[2]" />
              </div>
              <div className="space-y-2.5">
                <h4 className="text-xl font-bold text-slate-900 tracking-wide">
                  Mission
                </h4>
                <div className="w-12 h-1 bg-teal-600 rounded-full" />
                <p className="text-slate-800 leading-relaxed text-sm md:text-[14.5px] font-medium">
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
