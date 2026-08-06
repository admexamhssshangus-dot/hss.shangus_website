import React, { useState, useEffect } from 'react';
import { useOutletContext, useLocation, Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Eye, EyeOff, Lock, User, GraduationCap, UserCheck, 
  AlertCircle, CheckCircle, ArrowRight, RefreshCw, Crown, Sparkles, 
  KeyRound, Mail, School, Award, CheckCircle2, ChevronRight, Compass
} from 'lucide-react';
import SEO from '../components/SEO';
import { auth, googleProvider, db } from '../services/firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';

export default function LoginPage() {
  const { onLoginSuccess, isAuthenticated, user } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();

  // If user is already authenticated, automatically redirect to their dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const roleKey = String(user.role).toLowerCase().trim();
      const dest =
        roleKey === 'student' ? '/portal/student'
        : (roleKey === 'teacher' || roleKey === 'faculty') ? '/portal/teacher'
        : '/portal/admin';
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Tab role selection: 'student' | 'teacher' | 'admin' | 'superadmin'
  const [selectedRole, setSelectedRole] = useState('student');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(() => {
    const msg = location.state?.message;
    if (msg && !msg.toLowerCase().includes('no longer valid') && !msg.toLowerCase().includes('expired')) {
      return { type: 'error', text: msg };
    }
    return null;
  });

  const isSuperAdmin = selectedRole === 'superadmin';

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const userEmail = (fbUser?.email || '').toLowerCase();

      const tabFallbackRole = selectedRole === 'superadmin' ? 'SuperAdmin'
        : selectedRole === 'admin' ? 'Admin'
        : selectedRole === 'teacher' ? 'Teacher'
        : 'Student';

      let resolvedRole = tabFallbackRole;
      let resolvedName = fbUser?.displayName || userEmail;

      if (userEmail === 'adm.exam.hss.shangus@gmail.com') {
        resolvedRole = 'SuperAdmin';
        resolvedName = resolvedName || 'Sheikh Gulfam (SuperAdmin)';
      } else if (userEmail === 'shahnawaz@gmail.com') {
        resolvedRole = 'Admin';
        resolvedName = resolvedName || 'Nawaz Ahmad Shah (Admin)';
      } else if (userEmail === 'shahnawaz13678@gmail.com') {
        resolvedRole = 'Teacher';
        resolvedName = resolvedName || 'Nawaz Ahmad Shah (Teacher)';
      } else if (userEmail === 'bilalhcu@gmail.com') {
        resolvedRole = 'Admin';
        resolvedName = resolvedName || 'Bilal Ahmad Khandy (Admin)';
      } else if (userEmail === 'majidhassannajar@gmail.com') {
        resolvedRole = 'Admin';
        resolvedName = resolvedName || 'Majid Hassan Najar (Admin)';
      } else {
        try {
          const snap = await getDoc(doc(db, 'users', userEmail));
          if (snap.exists()) {
            const d = snap.data();
            resolvedRole = d.Role || d.role || tabFallbackRole;
            resolvedName = d.Name || d.name || resolvedName;
          } else {
            let q = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail))).catch(() => null);
            if (!q || q.empty) {
              q = await getDocs(query(collection(db, 'users'), where('Email', '==', userEmail))).catch(() => null);
            }
            if (q && !q.empty) {
              const d = q.docs[0].data();
              resolvedRole = d.Role || d.role || tabFallbackRole;
              resolvedName = d.Name || d.name || resolvedName;
            }
          }
        } catch (e) {
          console.warn('Firestore lookup error during Google login:', e);
        }
      }

      const userSession = {
        email: userEmail,
        name: resolvedName,
        role: resolvedRole,
        photoURL: fbUser?.photoURL || null,
        uid: fbUser?.uid || null,
      };

      onLoginSuccess({ user: userSession, token: await fbUser.getIdToken() }, keepLoggedIn);
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setAlert({ type: 'error', text: err.message || 'Google Sign-In failed. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setAlert({ type: 'error', text: 'Please enter both email and password.' });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      let firebaseUser = null;
      let idToken = null;

      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        firebaseUser = userCred.user;
        idToken = await firebaseUser.getIdToken();
      } catch (authErr) {
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
          if (cleanEmail === 'adm.exam.hss.shangus@gmail.com' && password === 'Gulfam@123') {
            try {
              const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
              firebaseUser = newCred.user;
              idToken = await firebaseUser.getIdToken();
            } catch (createErr) {
              console.warn('Auto create SuperAdmin account failed:', createErr);
            }
          }
        }
        if (!firebaseUser) {
          throw authErr;
        }
      }

      let resolvedRole = selectedRole === 'superadmin' ? 'SuperAdmin' : selectedRole === 'admin' ? 'Admin' : selectedRole === 'teacher' ? 'Teacher' : 'Student';
      let resolvedName = cleanEmail.split('@')[0];

      if (cleanEmail === 'adm.exam.hss.shangus@gmail.com') {
        resolvedRole = 'SuperAdmin';
        resolvedName = 'Sheikh Gulfam (SuperAdmin)';
      } else if (cleanEmail === 'shahnawaz@gmail.com') {
        resolvedRole = 'Admin';
        resolvedName = 'Nawaz Ahmad Shah (Admin)';
      } else if (cleanEmail === 'shahnawaz13678@gmail.com') {
        resolvedRole = 'Teacher';
        resolvedName = 'Nawaz Ahmad Shah (Teacher)';
      } else if (cleanEmail === 'bilalhcu@gmail.com') {
        resolvedRole = 'Admin';
        resolvedName = 'Bilal Ahmad Khandy (Admin)';
      } else {
        try {
          const userDoc = await getDoc(doc(db, 'users', cleanEmail));
          if (userDoc.exists()) {
            const data = userDoc.data();
            resolvedRole = data.Role || data.role || resolvedRole;
            resolvedName = data.Name || data.name || resolvedName;
          }
        } catch (dbErr) {
          console.warn('Firestore user fetch failed:', dbErr);
        }
      }

      const userSession = {
        email: cleanEmail,
        name: resolvedName,
        role: resolvedRole,
        uid: firebaseUser?.uid || null,
      };

      setAlert({ type: 'success', text: 'Login successful! Redirecting...' });
      setTimeout(() => {
        onLoginSuccess({ success: true, user: userSession, token: idToken }, keepLoggedIn);
      }, 400);

    } catch (err) {
      console.error('Login error:', err);
      let errMsg = 'Invalid email or password. Please check your credentials.';
      if (err.code === 'auth/too-many-requests') {
        errMsg = 'Too many failed login attempts. Please try again later or reset your password.';
      } else if (err.code === 'auth/network-request-failed') {
        errMsg = 'Network error. Please check your internet connection.';
      }
      setAlert({ type: 'error', text: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  // Role preview metadata for left hero card
  const ROLE_DETAILS = {
    student: {
      badge: 'Student Portal Desk',
      title: 'Online Admissions & Academic Dashboard',
      desc: 'Access your application status, download examination roll slips, verify fee receipts, and track attendance.',
      features: ['Admission Status & Roll Slips', 'Digital Fee Receipts & History', 'Practicals & Marks Evaluation'],
      color: 'teal',
      icon: GraduationCap,
    },
    teacher: {
      badge: 'Faculty Workspace Desk',
      title: 'Staff & Practical Evaluation Portal',
      desc: 'Record daily class attendance, upload awards and practical marks, and manage subject circulars.',
      features: ['Class Attendance Management', 'Practicals & Awards Evaluation', 'Student Academic Registers'],
      color: 'emerald',
      icon: UserCheck,
    },
    admin: {
      badge: 'Admin Control Center',
      title: 'Master School Management Suite',
      desc: 'Manage student registers, roll number allocations, subject definitions, and automated email dispatches.',
      features: ['Master Register & Admissions', 'Roll No Auto-Assigner Suite', 'Fund Accounts & Automations'],
      color: 'purple',
      icon: Lock,
    },
    superadmin: {
      badge: 'SuperAdmin Access Mode',
      title: 'Executive System Control',
      desc: 'Full administrative access across all student, faculty, financial, and monitoring modules.',
      features: ['System-wide Override Access', 'Anganwadi Poshan Monitoring', 'Security & System Controls'],
      color: 'amber',
      icon: Crown,
    },
  };

  const activeRoleInfo = ROLE_DETAILS[selectedRole] || ROLE_DETAILS.student;
  const RoleIcon = activeRoleInfo.icon;

  return (
    <div className="w-full min-h-[90vh] flex items-center justify-center py-6 px-3 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      <SEO
        title="Student & Staff Login Portal | HSS Shangus"
        description="Official Govt HSS Shangus Online Portal. Access admissions, roll slips, attendance tracking, and faculty utilities."
        path="/portal/login"
      />

      {/* Ambient Glowing Background Orbs */}
      <div className={`absolute top-1/4 -left-20 w-72 sm:w-96 h-72 sm:h-96 blur-3xl rounded-full pointer-events-none transition-all duration-700 ${
        isSuperAdmin ? 'bg-purple-500/15' : selectedRole === 'teacher' ? 'bg-emerald-500/15' : 'bg-teal-500/15'
      }`} />
      <div className={`absolute bottom-10 -right-20 w-72 sm:w-96 h-72 sm:h-96 blur-3xl rounded-full pointer-events-none transition-all duration-700 ${
        isSuperAdmin ? 'bg-indigo-500/15' : 'bg-cyan-500/15'
      }`} />

      {/* Responsive Container — Split-screen on Large (lg+), Compact Card on Mobile/Tablet */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">

        {/* LEFT COLUMN: HERO SHOWCASE (Visible on lg+ screens, stacked cleanly on tablet/mobile) */}
        <div className="lg:col-span-6 space-y-5 text-left hidden md:block px-2 sm:px-4">
          
          {/* Institution Header Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-slate-900/5 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-xs backdrop-blur-md">
            <School size={14} className="text-teal-600 dark:text-teal-400" />
            <span>Govt. Higher Secondary School Shangus</span>
          </div>

          {/* Main Hero Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight uppercase">
              Digital Student & Staff <span className="bg-gradient-to-r from-teal-600 via-emerald-500 to-indigo-600 bg-clip-text text-transparent">Portal</span>
            </h1>
            <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 mt-2 leading-relaxed max-w-lg">
              Official unified portal for students, faculty, and school administration. Access admissions, roll slips, attendance, and exam management.
            </p>
          </div>

          {/* Dynamic Active Role Feature Card */}
          <div className="rounded-3xl p-5 border shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/80 dark:border-slate-800/80 space-y-3.5 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-2xl ${
                  isSuperAdmin ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' 
                  : selectedRole === 'teacher' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                  : 'bg-teal-500/10 text-teal-600 border border-teal-500/20'
                }`}>
                  <RoleIcon size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    {activeRoleInfo.badge}
                  </span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {activeRoleInfo.title}
                  </h3>
                </div>
              </div>

              <span className="flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 size={12} /> Active
              </span>
            </div>

            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
              {activeRoleInfo.desc}
            </p>

            <div className="pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800">
              {activeRoleInfo.features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick System Stats Footer Bar */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 pt-2 px-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-teal-600 dark:text-teal-400" />
              256-Bit Encrypted Session
            </span>
            <span className="flex items-center gap-1.5">
              <Award size={14} className="text-indigo-600 dark:text-indigo-400" />
              Session 2026-27
            </span>
          </div>

        </div>

        {/* RIGHT COLUMN: MAIN LOGIN GLASS CARD (Fully Responsive 100% width on mobile, 6-col on lg) */}
        <div className="lg:col-span-6 w-full max-w-[440px] mx-auto lg:max-w-none">
          
          <div className={`rounded-3xl p-5 sm:p-8 border shadow-2xl transition-all duration-300 relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl ${
            isSuperAdmin ? 'border-purple-500/30 shadow-purple-500/10' : 'border-slate-200/80 dark:border-slate-800/80 shadow-teal-500/5'
          }`}>

            {/* Loading blur overlay */}
            {isLoading && (
              <div 
                className="absolute inset-0 z-50 rounded-3xl flex flex-col items-center justify-center gap-3 animate-fadeIn"
                style={{ backgroundColor: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
              >
                <div className="relative flex items-center justify-center">
                  <div 
                    className="absolute w-20 h-20 rounded-full border-[3px] border-transparent animate-spin"
                    style={{ borderTopColor: isSuperAdmin ? '#7c3aed' : '#0d9488', borderRightColor: isSuperAdmin ? '#a78bfa40' : '#14b8a640', animationDuration: '0.9s' }}
                  />
                  <div 
                    className="absolute w-16 h-16 rounded-full border-2 border-dashed animate-spin opacity-50"
                    style={{ borderColor: isSuperAdmin ? '#7c3aed' : '#0d9488', animationDuration: '2s', animationDirection: 'reverse' }}
                  />
                  <img src="/logo512.png" alt="HSS Shangus" className="w-10 h-10 object-contain relative z-10 drop-shadow-md" />
                </div>
                <p className="text-xs sm:text-sm font-black tracking-widest uppercase text-slate-800 dark:text-slate-200">
                  Authenticating Session...
                </p>
              </div>
            )}

            {/* Card Header: School Crest + Title + SuperAdmin Toggle */}
            <div className="relative z-10 space-y-3 mb-5">
              
              {/* Crest Logo */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center p-1.5 shadow-xs">
                    <img src="/logo512.png" alt="HSS Shangus Crest" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      HSS Shangus Portal
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Sign In
                    </h2>
                  </div>
                </div>

                {/* SuperAdmin Crown Toggle Button */}
                <button
                  type="button"
                  onClick={() => setSelectedRole(isSuperAdmin ? 'admin' : 'superadmin')}
                  title={isSuperAdmin ? 'Deactivate Superadmin Mode' : 'Superadmin Access'}
                  className={`group relative flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-300 cursor-pointer border ${
                    isSuperAdmin
                      ? 'bg-purple-600 border-purple-500 shadow-lg shadow-purple-600/30 text-white'
                      : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-purple-400 hover:text-purple-500 dark:hover:border-purple-600'
                  }`}
                >
                  <Crown
                    size={16}
                    className={isSuperAdmin ? 'fill-white text-white' : 'text-slate-400 group-hover:text-purple-500 transition-colors'}
                  />
                  {isSuperAdmin && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white dark:border-slate-900 animate-pulse" />
                  )}
                </button>
              </div>

              {isSuperAdmin && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 w-full justify-center">
                  <Crown size={13} /> SuperAdmin Access Mode Active
                </div>
              )}
            </div>

            {/* Segmented Control Role Selector Tabs */}
            <div className="grid grid-cols-3 p-1 rounded-2xl border text-xs font-black relative z-10 bg-slate-100/90 dark:bg-slate-950/90 border-slate-200 dark:border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => setSelectedRole('student')}
                className={`py-2.5 sm:py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                  selectedRole === 'student'
                    ? 'bg-teal-600 text-white shadow-md font-black scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-extrabold'
                }`}
              >
                <GraduationCap size={15} /> 
                <span className="truncate">Student</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('teacher')}
                className={`py-2.5 sm:py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                  selectedRole === 'teacher'
                    ? 'bg-emerald-600 text-white shadow-md font-black scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-extrabold'
                }`}
              >
                <UserCheck size={15} /> 
                <span className="truncate">Teacher</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole(isSuperAdmin ? 'superadmin' : 'admin')}
                className={`py-2.5 sm:py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                  selectedRole === 'admin' || isSuperAdmin
                    ? 'bg-purple-600 text-white shadow-md font-black scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-extrabold'
                }`}
              >
                <Lock size={15} /> 
                <span className="truncate">Admin</span>
              </button>
            </div>

            {/* Alert Notification Toast Box */}
            {alert && (
              <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 mb-4 animate-fadeIn ${
                alert.type === 'error'
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              }`}>
                {alert.type === 'error' ? <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> : <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />}
                <span className="leading-snug">{alert.text}</span>
              </div>
            )}

            {/* Main Interactive Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              
              {/* Email Input */}
              <div className="space-y-1 text-left">
                <label htmlFor="login-email" className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-3 rounded-2xl text-xs sm:text-sm font-bold border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 bg-slate-50/80 dark:bg-slate-950/80 text-slate-900 dark:text-white transition-all duration-200"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1 text-left">
                <label htmlFor="login-password" className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-3 rounded-2xl text-xs sm:text-sm font-bold border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 bg-slate-50/80 dark:bg-slate-950/80 text-slate-900 dark:text-white transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Options Row: Keep Logged In + Forgot Password */}
              <div className="flex items-center justify-between text-xs font-extrabold pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={keepLoggedIn}
                    onChange={(e) => setKeepLoggedIn(e.target.checked)}
                    className="rounded-md border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer w-4 h-4"
                  />
                  <span>Keep me logged in</span>
                </label>

                <Link to="/portal/forgot-password" className="text-teal-600 dark:text-teal-400 hover:underline font-black">
                  Forgot Password?
                </Link>
              </div>

              {/* Main Submit CTA Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm text-white shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] group ${
                  isSuperAdmin
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
                    : selectedRole === 'teacher'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                    : 'bg-teal-600 hover:bg-teal-500 shadow-teal-600/30'
                }`}
              >
                {isLoading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>{isSuperAdmin ? 'Sign In as SUPERADMIN' : `Sign In as ${selectedRole.toUpperCase()}`}</span>
                    <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Social Google OAuth Button */}
            <div className="relative z-10 pt-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3 rounded-2xl font-extrabold text-xs sm:text-sm border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-2xs hover:shadow-sm"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            {/* Registration Footer Link */}
            <div className="text-center text-xs relative z-10 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
              <span className="text-slate-500 font-bold">Don't have an account? </span>
              <Link to="/portal/register" className="text-teal-600 dark:text-teal-400 font-black hover:underline inline-flex items-center gap-1">
                Create New Account <ChevronRight size={13} />
              </Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
