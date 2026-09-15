import React, { useState, useEffect, useRef } from 'react';
import { Users, BookOpen, Award, Globe, Eye, Compass, Sparkles, ChevronDown, ChevronUp, Landmark, GraduationCap, ArrowDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import DynamicPageRenderer from '../components/DynamicPageRenderer';
import PublicPageSkeleton from '../components/PublicPageSkeleton';
import EducationalBackground from '../components/common/EducationalBackground';

export default function About() {
  const [dynamicData, setDynamicData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullGlimpse, setShowFullGlimpse] = useState(false);
  const fullGlimpseRef = useRef(null);

  const handleToggleGlimpses = () => {
    const nextState = !showFullGlimpse;
    setShowFullGlimpse(nextState);
    if (nextState) {
      setTimeout(() => {
        fullGlimpseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const docPromise = getDoc(doc(db, 'site', 'page_about'));
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1800));
        const snap = await Promise.race([docPromise, timeoutPromise]);
        if (snap && snap.exists() && isMounted) {
          const data = snap.data();
          if (data.blocks && data.blocks.length > 0) {
            setDynamicData(data);
          }
        }
      } catch (e) {
        // Fallback gracefully to default institutional layout
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return <PublicPageSkeleton label="Loading institutional information…" />;
  }

  if (dynamicData) {
    return <DynamicPageRenderer pageData={dynamicData} pageId="about" />;
  }

  const aboutBg = '/slides/aboutus.jpg';
  return (
    <div className="public-page w-full mb-20">
      <SEO title="About Us & Institution" description="Discover the history, vision, mission, and institutional glimpses of Govt. Higher Secondary School Shangus in Anantnag. Explore our academic legacy and campus heritage." />
      {/* Hero */}
      <div className="relative h-[304px] sm:h-[378px] w-full bg-slate-900 flex items-center justify-center text-center">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${aboutBg})` }}
        ></div>
        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 bg-black/50"></div>
        
        <div className="relative z-10 px-4 max-w-4xl mx-auto">
          <h1 className="ui-page-title text-2xl sm:text-3xl md:text-4xl text-white mb-2">About Our Institution</h1>
          <h3 className="text-xl sm:text-2xl font-semibold text-slate-200 mb-6">A Beacon of Knowledge</h3>
          <p className="text-slate-100 text-sm md:text-base leading-relaxed">Serving the Anantnag district with a long tradition of academic excellence and holistic student development.</p>
        </div>
      </div>

      {/* Main Educational Canvas with Watermark & Glow Backdrops */}
      <div className="relative w-full overflow-hidden isolate">
        <EducationalBackground variant="default" />

        {/* Glimpse + Vision & Mission */}
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-12 relative -mt-16 z-20">
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 border-t-4 border-teal-500 mb-6 sm:mb-8 relative overflow-hidden border border-slate-200/80">
            {/* Large decorative chinar leaf watermark */}
            <svg className="absolute -right-12 -top-8 w-64 h-64 text-teal-500/[0.04] pointer-events-none select-none" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M100 10 C95 30, 70 35, 50 25 C60 50, 55 70, 30 80 C55 85, 65 95, 60 120 C75 105, 90 100, 100 110 C110 100, 125 105, 140 120 C135 95, 145 85, 170 80 C145 70, 140 50, 150 25 C130 35, 105 30, 100 10Z M100 110 L100 190" strokeWidth="3" stroke="currentColor" fillOpacity="0.5"/>
            </svg>
            <svg className="absolute -left-10 bottom-0 w-48 h-48 text-teal-500/[0.03] pointer-events-none select-none rotate-45" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M100 10 C95 30, 70 35, 50 25 C60 50, 55 70, 30 80 C55 85, 65 95, 60 120 C75 105, 90 100, 100 110 C110 100, 125 105, 140 120 C135 95, 145 85, 170 80 C145 70, 140 50, 150 25 C130 35, 105 30, 100 10Z M100 110 L100 190" strokeWidth="3" stroke="currentColor" fillOpacity="0.5"/>
            </svg>

            {/* Section Header with Quick Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10 border-b border-teal-100/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-700">
                  <Landmark size={22} className="stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-teal-950 leading-tight">Glimpse of the Institution</h3>
                  <p className="text-xs text-slate-600 font-semibold">A legacy of learning, scenic splendor &amp; leadership since 1917</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleGlimpses}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow transition-all duration-200 cursor-pointer self-start sm:self-auto hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>{showFullGlimpse ? 'Hide Full Glimpses' : 'View Full Glimpses'}</span>
                <ChevronDown size={16} className={`transition-transform duration-300 ${showFullGlimpse ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Brief Single Summary Paragraph */}
            <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/40 shadow-sm relative z-10 space-y-3.5 mb-4">
              <p className="text-slate-800 leading-relaxed text-[15px] sm:text-base font-medium">
                Nestled amidst the breathtaking mountains of the Kashmir Valley and bordered by the serene Shangus Forest Lodge, <strong className="text-teal-900 font-bold">Govt. Higher Secondary School (HSS) Shangus</strong> has stood as a beacon of academic excellence and community collaboration since its establishment as a primary school in 1917, through its 1978–79 upgrades and Higher Secondary status in 2005. Serving a wide regional catchment from Kachwan to Uttresoo, our accomplished faculty fosters critical thinking, intellectual curiosity, and civic responsibility across modern classrooms, science laboratories, and library facilities—nurturing well-rounded scholars, consistent board distinction holders, and tomorrow's ethical leaders.
              </p>

              {/* Feature Highlight Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-teal-100 text-teal-900 border border-teal-300/80 text-xs font-bold">
                  <Sparkles size={13} className="text-teal-700" />
                  Est. 1917 Heritage
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300/80 text-xs font-bold">
                  <GraduationCap size={13} className="text-emerald-700" />
                  Higher Secondary (2005)
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300/80 text-xs font-bold">
                  <Award size={13} className="text-amber-700" />
                  Academic Distinctions
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-300/80 text-xs font-bold">
                  <Globe size={13} className="text-indigo-700" />
                  Kachwan to Uttresoo
                </span>
              </div>
            </div>

            {/* Expandable Detailed 4 Pillar Glimpses */}
            {showFullGlimpse && (
              <div ref={fullGlimpseRef} className="space-y-4 pt-2 animate-fadeIn relative z-10 scroll-mt-24">
                {/* Visual Scroll-Down Indicator Clue Banner */}
                <div className="flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 text-white shadow-md border border-teal-500/40 animate-pulse">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="p-1.5 rounded-lg bg-white/20 flex-shrink-0">
                      <ArrowDown size={18} className="animate-bounce" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold truncate sm:whitespace-normal">
                        4 Detailed Institutional Pillars Expanded Below
                      </p>
                      <p className="text-[11px] text-teal-100 hidden xs:block">
                        Scroll down to explore Campus, Heritage, Academics &amp; Leadership
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-teal-50 px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1">
                    <span>Scroll to Read</span>
                    <ArrowDown size={12} className="animate-bounce" />
                  </span>
                </div>

                {/* 1. A Haven of Learning */}
                <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 bg-gradient-to-br from-teal-50 to-emerald-50/70 border border-teal-200 shadow-sm hover:shadow-md transition-all duration-300 group">
                  <h4 className="text-base sm:text-lg font-bold text-teal-950 mb-2 relative z-10 group-hover:text-teal-800 transition-colors">A Haven of Learning in the Heart of the Kashmir Valley</h4>
                  <p className="text-slate-800 leading-relaxed text-sm sm:text-[14.5px] relative z-10">
                    Nestled amidst the breathtaking mountains of the Kashmir Valley, <strong className="text-teal-800 font-bold">Govt. Higher Secondary School (HSS) Shangus</strong> Anantnag is a vibrant educational institution renowned for its scenic location and commitment to academic excellence. The school's expansive campus, surrounded by lush greenery and the calming presence of the Shangus Forest Lodge, offers a serene and inspiring learning environment. Adorned by neighboring institutions like the esteemed Govt. Girls High School Shangus, Sub District Hospital Shangus, and the fire services garrison, HSS Shangus stands as a symbol of community and collaboration within the greater Shangus area.
                  </p>
                </div>

                {/* 2. A Legacy of Education Since 1917 */}
                <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 bg-gradient-to-bl from-amber-50 to-orange-50/70 border border-amber-200 shadow-sm hover:shadow-md transition-all duration-300 group">
                  <h4 className="text-base sm:text-lg font-bold text-amber-950 mb-2 relative z-10 group-hover:text-amber-800 transition-colors">A Legacy of Education Since 1917</h4>
                  <p className="text-slate-800 leading-relaxed text-sm sm:text-[14.5px] relative z-10">
                    Established in 1917 as a primary school, HSS Shangus boasts a rich history of serving the educational needs of the region. Its steady progression, with upgrades in 1978–79 and the achievement of Higher Secondary status in 2005, reflects the school's enduring commitment to providing quality instruction to generations of students. Our dedicated faculty, comprised of experienced educators, distinguished scholars, exceptional technocrats, and skilled professionals, fosters a stimulating academic environment for learners of all backgrounds.
                  </p>
                </div>

                {/* 3. Excellence in Academics and Beyond */}
                <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 bg-gradient-to-br from-indigo-50 to-blue-50/70 border border-indigo-200 shadow-sm hover:shadow-md transition-all duration-300 group">
                  <h4 className="text-base sm:text-lg font-bold text-indigo-950 mb-2 relative z-10 group-hover:text-indigo-800 transition-colors">Excellence in Academics and Beyond</h4>
                  <p className="text-slate-800 leading-relaxed text-sm sm:text-[14.5px] relative z-10">
                    HSS Shangus proudly serves a wide catchment area, attracting students from Kachwan to Uttresoo and beyond due to its reputation for exceptional teaching. Our consistent record of strong student performance, with numerous distinctions earned in both 10th and 12th class examinations, stands as a testament to the school's focus on academic rigor. Beyond the classroom, we nurture well-rounded individuals by providing enriching extracurricular activities, fostering leadership opportunities, and emphasizing the development of essential life skills. Our modern facilities, including spacious classrooms, well-equipped laboratories, and a comprehensive library, create a dynamic environment where students can explore their interests and reach their full potential.
                  </p>
                </div>

                {/* 4. Shaping Tomorrow's Leaders */}
                <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 bg-gradient-to-bl from-rose-50 to-pink-50/70 border border-rose-200 shadow-sm hover:shadow-md transition-all duration-300 group">
                  <h4 className="text-base sm:text-lg font-bold text-rose-950 mb-2 relative z-10 group-hover:text-rose-800 transition-colors">Shaping Tomorrow's Leaders</h4>
                  <p className="text-slate-800 leading-relaxed text-sm sm:text-[14.5px] relative z-10">
                    At HSS Shangus, we ignite a passion for lifelong learning and instill a strong sense of responsibility within our students. Our faculty employs innovative teaching methods, emphasizing both the acquisition of knowledge and the development of critical thinking abilities. We are deeply committed to preparing our students not only for academic success but also to become engaged citizens who make meaningful contributions to their communities and the world.
                  </p>
                </div>

                {/* Bottom Collapse Button */}
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFullGlimpse(false);
                      window.scrollTo({ top: Math.max(0, window.scrollY - 300), behavior: 'smooth' });
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl border border-teal-300 bg-white hover:bg-teal-50 text-teal-900 font-bold text-xs shadow-2xs hover:shadow transition-all duration-200 cursor-pointer"
                  >
                    <span>Collapse Glimpses</span>
                    <ChevronUp size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="pt-4 mt-2 border-t border-slate-200 relative z-10">
              <h4 className="text-sm font-bold text-teal-800 mb-1">Explore, Discover, Connect</h4>
              <p className="text-slate-700 text-[13.5px] font-medium leading-relaxed">Tour our vibrant campus, explore our curriculum, and connect with our admissions team to learn more!</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* VISION CARD */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white bg-gradient-to-br from-white to-amber-50/60 p-6 sm:p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="absolute right-4 bottom-[-10px] text-8xl font-black text-amber-500/10 select-none pointer-events-none group-hover:scale-110 transition-transform duration-500">
                V
              </div>
              
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 group-hover:rotate-6 transition-transform duration-300 flex-shrink-0">
                  <Eye size={24} className="stroke-[2]" />
                </div>
                <div className="space-y-2.5">
                  <h4 className="text-xl font-bold text-slate-950 tracking-wide">
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
            <div className="relative overflow-hidden rounded-2xl border border-teal-200 bg-white bg-gradient-to-br from-white to-teal-50/60 p-6 sm:p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="absolute right-4 bottom-[-10px] text-8xl font-black text-teal-500/10 select-none pointer-events-none group-hover:scale-110 transition-transform duration-500">
                M
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/20 group-hover:rotate-6 transition-transform duration-300 flex-shrink-0">
                  <Compass size={24} className="stroke-[2]" />
                </div>
                <div className="space-y-2.5">
                  <h4 className="text-xl font-bold text-slate-950 tracking-wide">
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

        {/* Values / Highlights - 1 per row on mobile! */}
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-8 text-center font-heading">Why Choose Govt. HSS Shangus?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-200/90 text-center flex flex-col items-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group border-t-4 border-t-teal-500">
              <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 mb-4 transition-transform duration-300 group-hover:scale-110 shadow-xs">
                <Users size={24} className="stroke-[2.5]" />
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1.5">Experienced Faculty</h4>
              <p className="text-xs sm:text-[13px] text-slate-700 font-medium leading-relaxed">Dedicated teachers focused on student growth, mentorship and academic excellence.</p>
            </div>

            <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-200/90 text-center flex flex-col items-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group border-t-4 border-t-indigo-500">
              <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 mb-4 transition-transform duration-300 group-hover:scale-110 shadow-xs">
                <BookOpen size={24} className="stroke-[2.5]" />
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1.5">Modern Labs &amp; Library</h4>
              <p className="text-xs sm:text-[13px] text-slate-700 font-medium leading-relaxed">Well-equipped Science labs, CAL/smart facilities and a curated resource library.</p>
            </div>

            <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-200/90 text-center flex flex-col items-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group border-t-4 border-t-amber-500">
              <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 mb-4 transition-transform duration-300 group-hover:scale-110 shadow-xs">
                <Award size={24} className="stroke-[2.5]" />
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1.5">Strong Results</h4>
              <p className="text-xs sm:text-[13px] text-slate-700 font-medium leading-relaxed">Consistent board examination distinctions and proven competitive academic outcomes.</p>
            </div>

            <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-200/90 text-center flex flex-col items-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group border-t-4 border-t-rose-500">
              <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 mb-4 transition-transform duration-300 group-hover:scale-110 shadow-xs">
                <Globe size={24} className="stroke-[2.5]" />
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1.5">Holistic Education</h4>
              <p className="text-xs sm:text-[13px] text-slate-700 font-medium leading-relaxed">Balanced focus on intellectual rigor, athletics, ethics, and values-based character development.</p>
            </div>
          </div>
        </div>

        {/* History / Timeline + CTA */}
        <div className="max-w-6xl mx-auto px-4 py-12 border-t border-slate-200/80">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4 font-heading">Our Story</h3>
              <p className="text-slate-800 leading-relaxed text-sm font-medium">From modest beginnings to a premier local institution, Govt. HSS Shangus has steadily expanded its academic offerings and infrastructure to meet the needs of families across Anantnag. Our commitment to inclusion and quality has guided our growth.</p>
              
              <div className="relative pl-6 border-l-2 border-teal-300 space-y-6 mt-8">
                {[
                  { year: '1917', title: 'Foundation', desc: 'School founded to serve local communities, establishing an enduring legacy of learning in the valley.' },
                  { year: '1978–79', title: 'Curricular Upgrade', desc: 'Upgraded with comprehensive middle and secondary academic curricula to support valley youths.' },
                  { year: '2005', title: 'Higher Secondary Upgrade', desc: 'Attained prestigious Higher Secondary status, establishing diverse Science & Humanities streams.' },
                  { year: 'Present', title: 'Smart Infrastructure & Excellence', desc: 'Modern laboratories, specialized smart classrooms, and a comprehensive library resource hub added.' }
                ].map((item, i) => (
                  <div key={i} className="relative group">
                    {/* Timeline Dot */}
                    <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-teal-600 bg-white group-hover:bg-teal-600 transition-colors duration-250 shadow-xs" />
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-teal-100 border border-teal-300/80 text-teal-900 font-extrabold text-[11px] mb-1.5">{item.year}</span>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{item.title}</h4>
                      <p className="text-xs sm:text-[13px] text-slate-700 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm flex flex-col items-start gap-4">
              <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 mb-1">
                <Landmark size={24} />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-slate-900 font-heading">Get Involved</h4>
              <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">Admissions are open for the upcoming academic session — join a forward-looking community that values academic rigor and character formation.</p>
              <Link to="/admissions" className="btn-primary-custom px-6 py-2.5 rounded-full font-bold shadow-md transition-all duration-200 text-xs tracking-wide uppercase mt-2">Apply Now</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
