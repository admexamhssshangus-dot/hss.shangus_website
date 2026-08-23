import React, { useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, User, Lock, Mail, Phone, Eye, EyeOff, 
  AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, 
  GraduationCap, Sparkles, School, ChevronRight, Award, 
  Check, FileCheck, CheckCircle
} from 'lucide-react';

import SEO from '../components/SEO';
import { auth, db, googleProvider } from '../services/firebase';
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  updateProfile, 
  signInWithPopup, 
  getIdTokenResult 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function RegisterPage() {
  const { onLoginSuccess } = useOutletContext();
  const navigate = useNavigate();

  // Form Fields (All-in-One Single Window)
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  // Quick Client-Side Validation Helpers
  const cleanMobile = mobile.replace(/\D/g, '').slice(0, 10);
  const isMobileValid = cleanMobile.length === 10;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasswordLongEnough = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordStrong = isPasswordLongEnough && (hasMixedCase || hasNumber);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Password Strength Calculation (0 to 3)
  const getPasswordStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (hasMixedCase) score += 1;
    if (hasNumber) score += 1;
    return score;
  };
  const passwordStrength = getPasswordStrength();

  // Handle Form Submission
  const handleRegister = async (e) => {
    if (e) e.preventDefault();

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Client-side quick UX guards
    if (!cleanName || cleanName.length < 2) {
      setAlert({ type: 'error', text: 'Please enter your full name (at least 2 characters).' });
      return;
    }
    if (!cleanMobile || cleanMobile.length !== 10) {
      setAlert({ type: 'error', text: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (!isEmailValid) {
      setAlert({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 8) {
      setAlert({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }
    if (password !== confirmPassword) {
      setAlert({ type: 'error', text: 'Passwords do not match. Please check and re-enter.' });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      // 1. Create Firebase Auth user (Single atomic network call with duplicate check)
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const fbUser = userCred.user;

      // 2. Set displayName in Firebase Auth
      await updateProfile(fbUser, { displayName: cleanName }).catch((err) => {
        console.warn('Profile name update note:', err);
      });

      // 3. Non-blocking verification email trigger (runs in background)
      sendEmailVerification(fbUser, {
        url: `${window.location.origin}/portal/login`,
        handleCodeInApp: false,
      }).catch((emailErr) => {
        console.warn('Email verification send note:', emailErr);
      });

      // 4. Save user demographic profile to Firestore using UID as document ID
      // NOTE: We only send requestedRole: 'Student'. Privilege escalation is blocked on server.
      const userData = {
        uid: fbUser.uid,
        email: cleanEmail,
        name: cleanName,
        mobile: cleanMobile,
        requestedRole: 'Student',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'users', fbUser.uid), userData, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore profile write note:', fsErr);
      }

      // 5. Seamless Auto-Login: Firebase Auth is already authenticated!
      const tokenResult = await getIdTokenResult(fbUser, true).catch(() => ({ token: null, claims: {} }));
      const userSession = {
        email: cleanEmail,
        name: cleanName,
        role: 'Student',
        uid: fbUser.uid,
        photoURL: fbUser.photoURL || null,
        perms: [],
      };

      setAlert({ type: 'success', text: 'Account created successfully! Entering Student Portal...' });

      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess({ user: userSession, token: tokenResult.token }, true);
        } else {
          navigate('/portal/student', { replace: true });
        }
      }, 450);

    } catch (err) {
      console.error('Registration failed:', err);
      let errMsg = 'Failed to create account. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        errMsg = 'An account with this email address already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'The password is too weak. Please use at least 8 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'The email address is invalid.';
      } else if (err.message) {
        errMsg = err.message;
      }
      setAlert({ type: 'error', text: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google 1-Click Registration / Sign-In
  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const cleanEmail = String(fbUser.email || '').toLowerCase().trim();
      const displayName = fbUser.displayName || cleanEmail.split('@')[0];

      // Save demographic profile using UID in Firestore
      const userData = {
        uid: fbUser.uid,
        email: cleanEmail,
        name: displayName,
        mobile: fbUser.phoneNumber || '',
        requestedRole: 'Student',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'users', fbUser.uid), userData, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore profile write note:', fsErr);
      }

      const tokenResult = await getIdTokenResult(fbUser, true).catch(() => ({ token: null, claims: {} }));
      const userSession = {
        email: cleanEmail,
        name: displayName,
        role: tokenResult.claims?.role || 'Student',
        uid: fbUser.uid,
        photoURL: fbUser.photoURL || null,
        perms: tokenResult.claims?.permissions || [],
      };

      setAlert({ type: 'success', text: 'Google sign-in successful! Entering Student Portal...' });
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess({ user: userSession, token: tokenResult.token }, true);
        } else {
          navigate('/portal/student', { replace: true });
        }
      }, 400);
    } catch (err) {
      console.error('Google Sign-Up failed:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setAlert({
          type: 'error',
          text: 'An account with this email address already exists. Please sign in with your email and password, or reset your password.'
        });
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setAlert({ type: 'error', text: err.message || 'Google Sign-In failed. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="portal-auth-page w-full min-h-[calc(100vh-var(--site-header-height,64px))] flex items-center justify-center py-6 px-3 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      <SEO
        title="Student Registration Portal | Govt HSS Shangus"
        description="Create your Govt Higher Secondary School Shangus student portal account in seconds. Access admissions, roll slips, attendance, and fee history."
        path="/portal/register"
      />

      {/* Ambient Glowing Background Orbs */}
      <div className="absolute top-1/4 -left-20 w-72 sm:w-96 h-72 sm:h-96 blur-3xl rounded-full pointer-events-none bg-teal-500/15 transition-all duration-700" />
      <div className="absolute bottom-10 -right-20 w-72 sm:w-96 h-72 sm:h-96 blur-3xl rounded-full pointer-events-none bg-cyan-500/15 transition-all duration-700" />

      {/* Responsive Container — Split-screen on Large (lg+), Centered Glass Card on Mobile/Tablet */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">

        {/* LEFT COLUMN: HERO SHOWCASE (Visible on lg+ screens, stacked cleanly on tablet/mobile) */}
        <div className="lg:col-span-6 space-y-5 text-left hidden md:block px-2 sm:px-4">
          
          {/* Institution Header Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-slate-900/5 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-xs backdrop-blur-md">
            <School size={14} className="text-teal-600 dark:text-teal-400" />
            <span>Govt. Higher Secondary School Shangus</span>
          </div>

          {/* Main Hero Title */}
          <div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight uppercase">
              <span className="moving-gradient-subtle">Digital Student</span>{' '}
              <span className="moving-gradient-text">Onboarding</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 mt-2 leading-relaxed max-w-lg">
              Create your official digital portal account in one easy step. Instant access to admission applications, digital examination roll slips, fee records, and marks.
            </p>
          </div>

          {/* Feature Showcase Card */}
          <div className="rounded-3xl p-5 border shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/80 dark:border-slate-800/80 space-y-3.5 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Student Portal Desk
                  </span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Official Student Account
                  </h3>
                </div>
              </div>

              <span className="flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 size={12} /> Instant Access
              </span>
            </div>

            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
              One account gives you seamless access to all academic services throughout your session.
            </p>

            <div className="pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800">
              {[
                'Online Admission Forms & Status Tracking',
                'Download Examination Roll Slips & Result Cards',
                'Digital Fee Payment Receipts & Academic Registers',
              ].map((feat, idx) => (
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
              Session 2025-26
            </span>
          </div>

        </div>

        {/* RIGHT COLUMN: MAIN REGISTRATION GLASS CARD */}
        <div className="lg:col-span-6 w-full max-w-[480px] mx-auto lg:max-w-none">
          <div className="rounded-3xl p-5 sm:p-7 border shadow-2xl transition-all duration-300 relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-slate-200/80 dark:border-slate-800/80 shadow-teal-500/5">

            {/* Loading blur overlay */}
            {isLoading && (
              <div 
                className="absolute inset-0 z-50 rounded-3xl flex flex-col items-center justify-center gap-3 animate-fadeIn"
                style={{ backgroundColor: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
              >
                <div className="relative flex items-center justify-center">
                  <div 
                    className="absolute w-20 h-20 rounded-full border-[3px] border-transparent animate-spin"
                    style={{ borderTopColor: '#0d9488', borderRightColor: '#14b8a640', animationDuration: '0.9s' }}
                  />
                  <div 
                    className="absolute w-16 h-16 rounded-full border-2 border-dashed animate-spin opacity-50"
                    style={{ borderColor: '#0d9488', animationDuration: '2s', animationDirection: 'reverse' }}
                  />
                  <img src="/logo512.png" alt="HSS Shangus" className="w-10 h-10 object-contain relative z-10 drop-shadow-md" />
                </div>
                <p className="text-xs sm:text-sm font-black tracking-widest uppercase text-slate-800 dark:text-slate-200">
                  Creating Student Account...
                </p>
              </div>
            )}

            {/* Card Header */}
            <div className="relative z-10 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                
                {/* Crest + Title */}
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center p-1.5 shadow-xs">
                    <img src="/logo512.png" alt="HSS Shangus Crest" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Student Portal
                    </span>
                    <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Student Registration
                    </h1>
                  </div>
                </div>

                {/* Back Button */}
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-2xs"
                  title="Go back"
                >
                  <ArrowLeft size={13} />
                  <span>Back</span>
                </button>
              </div>
            </div>

            {/* Alert Banner */}
            {alert && (
              <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 mb-4 animate-fadeIn relative z-10 ${
                alert.type === 'error' 
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400' 
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              }`}>
                {alert.type === 'error' ? <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> : <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />}
                <span>{alert.text}</span>
              </div>
            )}

            {/* Main Single-Window Form */}
            <form onSubmit={handleRegister} className="space-y-4 relative z-10">
              
              {/* Full Name */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="reg-name" className="block text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                  Full Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative group">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 dark:group-focus-within:text-teal-400 transition-colors pointer-events-none" />
                  <input
                    id="reg-name"
                    type="text"
                    placeholder="Enter student full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-[13.5px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15 dark:focus:ring-teal-500/25 transition-all duration-150"
                  />
                </div>
              </div>

              {/* Grid for Mobile & Email on tablet/desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
                
                {/* Mobile Number */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="reg-mobile" className="block text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                      Mobile Number <span className="text-rose-500 font-bold">*</span>
                    </label>
                    {mobile.length > 0 && (
                      <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded ${isMobileValid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {cleanMobile.length}/10 {isMobileValid ? '✓' : ''}
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 dark:group-focus-within:text-teal-400 transition-colors pointer-events-none" />
                    <input
                      id="reg-mobile"
                      type="tel"
                      placeholder="10-digit mobile"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                      autoComplete="tel"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-[13.5px] font-medium border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-3 transition-all duration-150 ${
                        mobile.length > 0 && isMobileValid
                          ? 'border-emerald-500/60 focus:border-emerald-600 focus:ring-emerald-500/15'
                          : 'border-slate-200 dark:border-slate-700 focus:border-teal-600 dark:focus:border-teal-500 focus:ring-teal-500/15 dark:focus:ring-teal-500/25'
                      }`}
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-email" className="block text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                    Email Address <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative group">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 dark:group-focus-within:text-teal-400 transition-colors pointer-events-none" />
                    <input
                      id="reg-email"
                      type="email"
                      placeholder="student@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-[13.5px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15 dark:focus:ring-teal-500/25 transition-all duration-150"
                    />
                  </div>
                </div>

              </div>

              {/* Grid for Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
                
                {/* Create Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="reg-password" className="block text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                      Password <span className="text-rose-500 font-bold">*</span>
                    </label>
                    {password.length > 0 && (
                      <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded ${
                        passwordStrength >= 3 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300' 
                          : passwordStrength >= 2 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300' 
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {passwordStrength >= 3 ? 'Strong' : passwordStrength >= 2 ? 'Good' : 'Min 8 chars'}
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 dark:group-focus-within:text-teal-400 transition-colors pointer-events-none" />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl text-[13.5px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15 dark:focus:ring-teal-500/25 transition-all duration-150"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="reg-confirm-password" className="block text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                      Confirm Password <span className="text-rose-500 font-bold">*</span>
                    </label>
                    {confirmPassword.length > 0 && (
                      <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded ${passwordsMatch ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                        {passwordsMatch ? '✓ Matches' : '✗ Mismatch'}
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 dark:group-focus-within:text-teal-400 transition-colors pointer-events-none" />
                    <input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-[13.5px] font-medium border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-3 transition-all duration-150 ${
                        confirmPassword.length > 0
                          ? passwordsMatch
                            ? 'border-emerald-500/60 focus:border-emerald-600 focus:ring-emerald-500/15'
                            : 'border-rose-500/60 focus:border-rose-600 focus:ring-rose-500/15'
                          : 'border-slate-200 dark:border-slate-700 focus:border-teal-600 dark:focus:border-teal-500 focus:ring-teal-500/15 dark:focus:ring-teal-500/25'
                      }`}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

              </div>

              {/* Password Strength Indicator Bar */}
              {password.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${
                      passwordStrength >= 1 ? 'bg-rose-500' : 'bg-transparent'
                    }`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${
                      passwordStrength >= 2 ? 'bg-amber-500' : 'bg-transparent'
                    }`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${
                      passwordStrength >= 3 ? 'bg-emerald-500' : 'bg-transparent'
                    }`} />
                  </div>
                </div>
              )}

              {/* Main Submit CTA Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-md shadow-teal-700/20 hover:shadow-lg hover:shadow-teal-700/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] mt-3"
              >
                {isLoading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Create Account &amp; Enter Portal</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Social Google OAuth Button */}
            <div className="relative z-10 pt-3">
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl font-semibold text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Quick Sign Up with Google</span>
              </button>
            </div>

            {/* Institutional Faculty / Admin Note */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1 relative z-10 mt-3">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block">
                Faculty &amp; Staff Registration Notice
              </span>
              <p className="text-[10.5px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                Teacher and Administrator portal accounts are provisioned internally by School Administration. Self-registration creates a Student account.
              </p>
            </div>

            {/* Sign In Footer Link */}
            <div className="text-center text-xs relative z-10 pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
              <span className="text-slate-500 font-medium">Already have an account? </span>
              <Link to="/portal/login" className="text-teal-600 dark:text-teal-400 font-bold hover:underline inline-flex items-center gap-1">
                Sign In Here <ChevronRight size={13} />
              </Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
