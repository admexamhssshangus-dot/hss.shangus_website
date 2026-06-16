import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Phone, Mail, User } from 'lucide-react';
import SEO from '../components/SEO';

// WhatsApp SVG Icon component
function WhatsAppIcon({ size = 14, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.024-5.11-2.887-6.974C16.486 1.91 14.018.883 11.399.883c-5.438 0-9.863 4.42-9.866 9.861 0 1.764.496 3.488 1.443 5.074l-1.012 3.693 3.793-1.042L6.647 19.16zM17.15 13.9c-.282-.142-1.67-.824-1.929-.918-.258-.094-.447-.142-.635.142-.188.283-.729.918-.894 1.106-.165.188-.329.212-.612.071-.282-.141-1.192-.44-2.271-1.402-.84-.749-1.407-1.673-1.572-1.956-.165-.283-.018-.436.123-.576.127-.126.282-.329.424-.494.141-.165.188-.282.282-.47.094-.188.047-.353-.024-.494-.071-.141-.635-1.53-.87-2.094-.229-.553-.46-.477-.635-.486-.164-.008-.353-.01-.54-.01-.188 0-.494.07-.753.353-.258.282-.988.965-.988 2.353s1.011 2.73 1.152 2.918c.142.188 1.99 3.04 4.821 4.261.673.29 1.2.463 1.609.593.676.214 1.291.184 1.777.112.541-.08 1.67-.682 1.905-1.341.235-.659.235-1.223.165-1.341-.07-.118-.259-.188-.541-.33z" />
    </svg>
  );
}


// Reusable faculty card used in both Teaching and Non-Teaching grids
function FacultyCard({ member, faculty, setActiveProfileMember }) {
  const nameParts = member.name.replace(/^(Mr\.|Mrs\.|Dr\.|Ms\.)\s+/i, '').split(' ');
  const initials = (nameParts[0]?.[0] || '') + (nameParts[nameParts.length - 1]?.[0] || '');
  const gradients = [
    'from-teal-500 to-indigo-600',
    'from-rose-500 to-orange-500',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-violet-600',
    'from-amber-500 to-red-500'
  ];
  const hash = member.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const grad = gradients[hash % gradients.length];
  const duplicateNames = faculty.filter(f => f.name && f.name.trim().toLowerCase() === member.name.trim().toLowerCase()).length > 1;

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col items-center text-center transition-all duration-300 hover:shadow-lg hover:border-teal-500 hover:-translate-y-1 group relative overflow-hidden">
      {/* Accent top bar on hover */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-transparent group-hover:bg-teal-500 transition-colors" />

      {/* Photo */}
      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 group-hover:border-teal-500 transition-colors shadow-sm mb-4 bg-white flex items-center justify-center">
        {member.photo ? (
          <img src={member.photo} alt={member.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-tr ${grad} flex items-center justify-center text-white font-extrabold text-base tracking-wide select-none`}>
            {initials.toUpperCase() || 'HSS'}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex gap-1 flex-wrap justify-center mb-1.5">
        <span className="text-[9px] uppercase font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-100">{member.department}</span>
        {(member.if_deployed === 'in' || member.if_deployed === 'Yes') && (
          <span className="text-[9px] uppercase font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">→ Deployed In</span>
        )}
        {member.if_deployed === 'out' && (
          <span className="text-[9px] uppercase font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">← Deployed Out</span>
        )}
      </div>

      <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-0.5 leading-tight line-clamp-1" title={member.name}>{member.name}</h4>
      {duplicateNames && (
        <p className="text-[9px] text-teal-700 font-extrabold mb-0.5 px-1 py-0.5 rounded bg-teal-50/60 border border-teal-100 inline-block w-fit">
          {member.cpis_no ? `CPIS: ${member.cpis_no}` : (member.mobile ? `Mob: ${member.mobile}` : '')}
        </p>
      )}
      <p className="text-[10px] sm:text-xs text-slate-500 font-semibold mb-2.5 leading-tight line-clamp-2 min-h-[2rem] flex items-center justify-center">
        {member.designation}{(member.subject && !['Administration', 'MTS'].includes(member.department)) ? ` in ${member.subject}` : ''}
      </p>

      {/* Actions */}
      <div className="mt-auto w-full border-t border-slate-200 pt-2 flex items-center justify-center gap-2">
        {member.profile && (
          <button onClick={() => setActiveProfileMember(member)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-500 hover:shadow flex items-center justify-center transition-all cursor-pointer" title="View Full Profile">
            <User size={14} />
          </button>
        )}
        {member.mobile && (
          <a href={`tel:${member.mobile}`} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-500 hover:shadow flex items-center justify-center transition-all" title="Call">
            <Phone size={14} />
          </a>
        )}
        {member.mobile && (
          <a href={`https://wa.me/${member.mobile.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-500 hover:shadow flex items-center justify-center transition-all" title="WhatsApp">
            <WhatsAppIcon size={14} />
          </a>
        )}
        {member.email && (
          <a href={`mailto:${member.email}`} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-500 hover:shadow flex items-center justify-center transition-all" title="Email">
            <Mail size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function Academics() {

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalItems, setModalItems] = useState([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('science');
  const [tabAnimating, setTabAnimating] = useState(false);
  const [faculty, setFaculty] = useState([]);
  const [selectedDept, setSelectedDept] = useState('All');
  const [activeProfileMember, setActiveProfileMember] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadFaculty() {
      // 1. Check local storage override first (for admin instant testing)
      const local = localStorage.getItem('site_faculty');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && active) {
            setFaculty(parsed);
            return;
          }
        } catch (e) {
          console.warn('Error reading site_faculty from localStorage:', e);
        }
      }

      // 2. Fetch from server
      try {
        const res = await fetch('/slides/faculty.json?t=' + Date.now(), { cache: 'no-cache' });
        if (!res.ok) throw new Error('Faculty config file not found');
        const data = await res.json();
        if (active) setFaculty(data);
      } catch (err) {
        console.warn('Failed to fetch faculty.json, using fallback mock data:', err);
        if (active) {
          setFaculty([
            {
              "name": "Mr. Aijaz Ahmad Wagay",
              "designation": "Principal",
              "subject": "Chemistry",
              "email": "ghssshangus74@gmail.com",
              "mobile": "+91-7006034501",
              "photo": "/slides/Principal.jpg",
              "department": "Administration"
            },
            {
              "name": "Mr. Sheikh Gulfam",
              "designation": "Lecturer",
              "subject": "Botany",
              "email": "sheikhgulfam91@gmail.com",
              "mobile": "+91-9682547458",
              "photo": "/slides/Gulfam.jpg",
              "department": "Science"
            },
            {
              "name": "Dr. Tariq Ahmad",
              "designation": "Lecturer",
              "subject": "Physics",
              "email": "tariq.physics@gmail.com",
              "mobile": "+91-7006123456",
              "photo": "",
              "department": "Science"
            },
            {
              "name": "Mrs. Shazia Kouser",
              "designation": "Lecturer",
              "subject": "Chemistry",
              "email": "shazia.chem@gmail.com",
              "mobile": "+91-7006234567",
              "photo": "",
              "department": "Science"
            },
            {
              "name": "Mr. Mohammad Yousuf",
              "designation": "Lecturer",
              "subject": "Economics",
              "email": "yousuf.econ@gmail.com",
              "mobile": "+91-7006345678",
              "photo": "",
              "department": "Humanities"
            },
            {
              "name": "Mrs. Rukhsana Akhtar",
              "designation": "Lecturer",
              "subject": "English",
              "email": "rukhsana.eng@gmail.com",
              "mobile": "+91-7006456789",
              "photo": "",
              "department": "Humanities"
            },
            {
              "name": "Mr. Fayaz Ahmad",
              "designation": "Teacher",
              "subject": "Information Technology",
              "email": "fayaz.it@gmail.com",
              "mobile": "+91-7006567890",
              "photo": "",
              "department": "Secondary"
            }
          ]);
        }
      }
    }
    loadFaculty();
    return () => { active = false; };
  }, []);

  // Listen to cross-tab data sync broadcasts
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('hss_data_sync');
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'UPDATE_DATA') {
          const local = localStorage.getItem('site_faculty');
          if (local) {
            try {
              const parsed = JSON.parse(local);
              if (Array.isArray(parsed)) {
                setFaculty(parsed);
              }
            } catch (err) {
              console.warn('Failed to sync site_faculty:', err);
            }
          }
        }
      };
      return () => channel.close();
    } catch (err) {
      // ignore
    }
  }, []);

  const visibleFaculty = faculty.filter(f => !f.hidden);
  const filteredFaculty = selectedDept === 'All'
    ? visibleFaculty
    : visibleFaculty.filter(f => f.department.toLowerCase() === selectedDept.toLowerCase());

  // Classify into Teaching vs Non-Teaching
  const isNonTeaching = (f) => {
    const d = (f.designation || '').toLowerCase();
    const dept = (f.department || '').toLowerCase();
    return dept === 'mts' ||
      d.includes('mts') || d.includes('lab assistant') || d.includes('lab bearer') ||
      d.includes('library bearer') || d.includes('peon') || d.includes('chowkidar') ||
      d.includes('safaiwalla') || d.includes('class iv') || d.includes('driver') ||
      d.includes('attendant');
  };

  const teachingFaculty = filteredFaculty.filter(f => !isNonTeaching(f));
  const nonTeachingFaculty = filteredFaculty.filter(f => isNonTeaching(f));

  function switchTab(tab) {
    if (tab === activeTab) return;
    setTabAnimating(true);
    setActiveTab(tab);
    setTimeout(() => setTabAnimating(false), 200);
  }

  function combine(arr, k) {
    const res = [];
    function helper(start, combo) {
      if (combo.length === k) {
        res.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        helper(i + 1, combo);
        combo.pop();
      }
    }
    if (k <= 0) return [[]];
    helper(0, []);
    return res;
  }

  function showCombinations(stream, levelLabel) {
    let groupA = [];
    let groupB = [];
    // Group C varies by stream: exclude Environmental Science and Physical Education for secondary (9th & 10th)
    let groupC = ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'];

    if (stream === 'science') {
      groupA = ['General English', 'Physics', 'Chemistry'];
      groupB = ['Biology', 'Mathematics'];
    } else if (stream === 'humanities') {
      groupA = ['General English'];
      groupB = ['Urdu', 'Education', 'Economics', 'History', 'Political Science', 'Mathematics'];
    } else {
      groupA = ['English', 'Mathematics', 'Science', 'Social Studies'];
      groupB = ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'];
    }

    const base = [...groupA];
    const need = Math.max(0, 5 - base.length);
    // For secondary (9th & 10th) exclude some Group C subjects
    const effectiveGroupC = stream === 'secondary' ? ['Healthcare', 'IT and ITES'] : groupC;
    const options = [...groupB, ...effectiveGroupC];
    const chosen = combine(options, need);
    // enforce selection rules:
    // - humanities: require exactly 3 from groupB and 1 from groupC
    // - science: disallow choosing both options from Group C (must be either 2 from B or 1 from B + 1 from C)
    let valid = chosen;
    if (stream === 'humanities') {
      valid = chosen.filter(arr => {
        const countB = arr.filter(x => groupB.includes(x)).length;
        const countC = arr.filter(x => groupC.includes(x)).length;
        return countB === 3 && countC === 1;
      });
    } else if (stream === 'science') {
      valid = chosen.filter(arr => {
        const countB = arr.filter(x => groupB.includes(x)).length;
        const countC = arr.filter(x => groupC.includes(x)).length;
        // allowed patterns: (B=2,C=0) or (B=1,C=1)
        return (countB === 2 && countC === 0) || (countB === 1 && countC === 1);
      });
    }
    const combos = valid.map(arr => [...base, ...arr].join(' • '));
    const unique = Array.from(new Set(combos)).sort();

    setModalTitle(`${levelLabel} — ${stream.charAt(0).toUpperCase() + stream.slice(1)} (${unique.length})`);
    setModalItems(unique);
    setModalOpen(true);
  }

  function copyList() {
    const text = modalItems.join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopied(false);
    });
  }

  function downloadList() {
    const blob = new Blob([modalItems.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'combinations.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function CombinationsModal() {
    const overlayRef = useRef(null);
    const [entered, setEntered] = useState(false);

    useEffect(() => {
      function onKey(e) {
        if (e.key === 'Escape') setModalOpen(false);
      }
      document.addEventListener('keydown', onKey);
      setEntered(true);
      return () => document.removeEventListener('keydown', onKey);
    }, []);

    if (!modalOpen) return null;

    return (
      <div ref={overlayRef} onMouseDown={(e) => { if (e.target === overlayRef.current) setModalOpen(false); }} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-3">
        <div onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={`bg-white rounded-lg max-w-2xl w-full p-3 shadow-lg transform transition-all duration-200 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`} tabIndex={-1}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-800 font-semibold text-sm">{modalTitle}</div>
            <div className="flex items-center gap-2">
              <button onClick={copyList} className="text-xs px-2 py-1 bg-slate-100 rounded">Copy</button>
              <button onClick={downloadList} className="text-xs px-2 py-1 bg-slate-100 rounded">Download</button>
              <button onClick={() => setModalOpen(false)} className="text-xs px-2 py-1 bg-slate-50 rounded">Close</button>
            </div>
          </div>
          <div className="max-h-[60vh] sm:max-h-72 overflow-auto text-sm text-slate-700 p-1">
            {modalItems.map((it, idx) => (
              <div key={idx} className="py-1 border-b border-slate-100 text-sm flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={14} />{it}</div>
            ))}
            {modalItems.length === 0 && <div className="text-slate-400">No combinations available.</div>}
          </div>
          {copied && <div className="text-xs text-teal-600 mt-2">Copied to clipboard</div>}
        </div>
      </div>
    );
  }

  // reduce whitespace above/below heading by ~40%: smaller paddings/margins
  return (
    <div className="w-full bg-gradient-to-b from-teal-50 to-white py-4 sm:py-6">
      <SEO title="Academic Streams & Combinations" description="Explore the school departments, subjects, and curriculum choices for secondary and higher secondary levels at Govt. Higher Secondary School Shangus." />
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="hidden">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Subject Combinations & Streams</h2>
          <div className="h-1 w-24 bg-gradient-to-r from-teal-500 to-teal-600 mx-auto mt-3 rounded"></div>
          <p className="text-sm text-slate-500 mt-3">Explore curated subject combinations for each stream with quick copy and download options.</p>
        </div>

        <div className="bg-white p-3 sm:p-3 rounded-lg shadow-sm border border-slate-200 mb-4">
          <h3 className="text-xl font-bold text-teal-800 mb-4">Our Departments</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-bold text-sm text-slate-600 mb-3 uppercase tracking-wider">Secondary (9th - 10th)</h4>
              <div className="flex flex-wrap gap-2">
                {['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies', 'IT & ITES', 'Healthcare'].map(sub => (
                  <span key={sub} className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-md font-medium border border-slate-200">{sub}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-600 mb-3 uppercase tracking-wider">Higher Secondary (11th - 12th)</h4>
              <div className="flex flex-wrap gap-2">
                {['General English', 'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Environmental Science', 'Physical Education', 'IT & ITES', 'Healthcare', 'Education', 'History', 'Political Science', 'Economics', 'Urdu'].map(sub => (
                  <span key={sub} className="bg-teal-50 text-teal-800 text-xs px-2 py-1 rounded-md font-medium border border-teal-100">{sub}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-5 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-teal-800 mb-2">Subject Combinations & Streams</h2>
          <p className="text-sm text-slate-500 mb-4">Explore curated subject combinations for each stream with quick copy and download options.</p>

          <CombinationsModal />

          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
            <div className="flex bg-slate-100/80 p-1 rounded-xl gap-1 mb-4 border border-slate-200">
              <button
                onClick={() => switchTab('science')}
                className={`flex-1 text-center py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-300 ${activeTab === 'science'
                  ? 'bg-teal-600 text-white shadow-sm scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
              >
                Science
              </button>
              <button
                onClick={() => switchTab('humanities')}
                className={`flex-1 text-center py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-300 ${activeTab === 'humanities'
                  ? 'bg-amber-600 text-white shadow-sm scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
              >
                Humanities
              </button>
              <button
                onClick={() => switchTab('secondary')}
                className={`flex-1 text-center py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-300 ${activeTab === 'secondary'
                  ? 'bg-violet-600 text-white shadow-sm scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
              >
                9th & 10th
              </button>
            </div>

            <div className={`grid md:grid-cols-3 gap-3 transition-all duration-200 ${tabAnimating ? 'opacity-60 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
              <div>
                <div className="text-xs uppercase text-slate-500 font-semibold mb-2">Group A</div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100 text-slate-800 font-medium text-sm">
                  {activeTab === 'science' && 'General English, Physics, Chemistry'}
                  {activeTab === 'humanities' && 'General English'}
                  {activeTab === 'secondary' && 'English, Mathematics, Science, Social Studies'}
                </div>
                <div className="text-xs text-slate-400 mt-2">Compulsory</div>
              </div>

              <div>
                <div className="text-xs uppercase text-slate-500 font-semibold mb-2">Group B (Options)</div>
                <div className="bg-white p-2 rounded border border-slate-100">
                  <ul className="space-y-2">
                    {activeTab === 'science' && ['Biology', 'Mathematics'].map(s => (
                      <li key={s} className="text-slate-700 text-sm flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={14} />{s}</li>
                    ))}
                    {activeTab === 'humanities' && ['Urdu', 'Education', 'Economics', 'History', 'Political Science', 'Mathematics'].map(s => (
                      <li key={s} className="text-slate-700 text-sm flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={14} />{s}</li>
                    ))}
                    {activeTab === 'secondary' && ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'].map(s => (
                      <li key={s} className="text-slate-700 text-sm flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={14} />{s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <div className="text-xs uppercase text-slate-500 font-semibold mb-2">Group C (Options)</div>
                <div className="bg-white p-2 rounded border border-slate-100">
                  <ul className="space-y-2">
                    {(activeTab === 'secondary' ? ['Healthcare', 'IT and ITES'] : ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES']).map(s => (
                      <li key={s} className="text-slate-700 text-sm flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={14} />{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                onClick={() => showCombinations(activeTab === 'secondary' ? 'secondary' : activeTab, activeTab === 'secondary' ? '9th & 10th' : '11th & 12th')}
                className="w-fit btn-primary-custom px-4 py-2 rounded-lg font-semibold text-sm shadow transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                View List
              </button>
              <div className="text-xs text-slate-500">
                {activeTab === 'science' && 'Compulsory (3). Choose 2 more: either both from Group B, or 1 from Group B and 1 from Group C (both from Group C not allowed).'}
                {activeTab === 'humanities' && 'Compulsory (1). Choose 3 from Group B and 1 from Group C.'}
                {activeTab === 'secondary' && 'Students have to take a maximum of 5 subjects (some may take 6 depending on choices).'}
              </div>
            </div>
          </div>
        </div>

        {/* Faculty & Staff Directory Section */}
        <div className="bg-white p-3.5 sm:p-5 rounded-xl shadow-sm border border-slate-200 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <div>
              <h3 className="text-xl font-bold text-teal-800 font-heading">Our Distinguished Community</h3>
              <p className="text-sm text-slate-500 mt-1">Meet our dedicated staff.</p>
            </div>
            {/* Filter controls */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0">
              {['All', 'Science', 'Humanities', 'Secondary', 'Administration', 'MTS'].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${selectedDept === dept ? 'bg-teal-800 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          {/* ── Teaching / Faculty ── */}
          {teachingFaculty.length > 0 && (
            <>
              <div className="flex items-center gap-3 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
                  Teaching / Faculty
                </span>
                <span className="text-xs text-slate-400 font-mono">{teachingFaculty.length} member{teachingFaculty.length !== 1 ? 's' : ''}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {teachingFaculty.map((member, idx) => (
                  <FacultyCard key={idx} member={member} faculty={faculty} setActiveProfileMember={setActiveProfileMember} />
                ))}
              </div>
            </>
          )}

          {/* ── Non-Teaching Staff ── */}
          {nonTeachingFaculty.length > 0 && (
            <>
              <div className="flex items-center gap-3 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-violet-50 text-violet-700 border border-violet-200">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                  Non-Teaching Staff
                </span>
                <span className="text-xs text-slate-400 font-mono">{nonTeachingFaculty.length} member{nonTeachingFaculty.length !== 1 ? 's' : ''}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {nonTeachingFaculty.map((member, idx) => (
                  <FacultyCard key={idx} member={member} faculty={faculty} setActiveProfileMember={setActiveProfileMember} />
                ))}
              </div>
            </>
          )}

          {filteredFaculty.length === 0 && (
            <div className="col-span-3 py-12 text-center text-slate-400 italic text-sm">
              No faculty members found for the selected filter.
            </div>
          )}
        </div>

        {/* Profile Modal */}
        {activeProfileMember && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
              {/* Colored Accent Header block */}
              <div className="bg-gradient-to-r from-teal-800 to-teal-700 p-6 text-white relative">
                <button
                  onClick={() => setActiveProfileMember(null)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
                <div className="flex gap-4 items-center">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/50 bg-white flex-shrink-0 flex items-center justify-center shadow-md">
                    {activeProfileMember.photo ? (
                      <img src={activeProfileMember.photo} alt={activeProfileMember.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      (() => {
                        const nameParts = activeProfileMember.name.replace(/^(Mr\.|Mrs\.|Dr\.|Ms\.)\s+/i, '').split(' ');
                        const initials = (nameParts[0]?.[0] || '') + (nameParts[nameParts.length - 1]?.[0] || '');
                        const gradients = [
                          'from-teal-500 to-indigo-600',
                          'from-rose-500 to-orange-500',
                          'from-emerald-500 to-teal-600',
                          'from-blue-500 to-violet-600',
                          'from-amber-500 to-red-500'
                        ];
                        const hash = activeProfileMember.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                        const grad = gradients[hash % gradients.length];
                        return (
                          <div className={`w-full h-full bg-gradient-to-tr ${grad} flex items-center justify-center text-white font-extrabold text-base tracking-wide select-none`}>
                            {initials.toUpperCase() || 'HSS'}
                          </div>
                        );
                      })()
                    )}
                  </div>
                  <div className="text-left">
                    <div className="flex gap-1.5 flex-wrap mb-1.5">
                      <span className="text-[9px] uppercase tracking-wider font-bold bg-white/20 px-2 py-0.5 rounded-full inline-block">
                        {activeProfileMember.department}
                      </span>
                      {(activeProfileMember.if_deployed === 'Yes' || activeProfileMember.if_deployed === 'in') && (
                        <span className="text-[9px] uppercase tracking-wider font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full inline-block">
                          Deployed In
                        </span>
                      )}
                      {activeProfileMember.if_deployed === 'out' && (
                        <span className="text-[9px] uppercase tracking-wider font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full inline-block">
                          Deployed Out
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-lg leading-tight">{activeProfileMember.name}</h4>
                    <p className="text-xs text-white/80 mt-0.5">{activeProfileMember.designation}{(activeProfileMember.subject && !['Administration', 'MTS'].includes(activeProfileMember.department)) ? ` in ${activeProfileMember.subject}` : ''}</p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[350px] custom-scrollbar text-left">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Biography & Professional Profile</h5>
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {activeProfileMember.profile}
                </p>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setActiveProfileMember(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
