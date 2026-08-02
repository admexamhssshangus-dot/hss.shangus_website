import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock, User, GraduationCap, UserCheck, AlertCircle, CheckCircle, ArrowRight, RefreshCw, Crown, Sparkles } from 'lucide-react';
import SEO from '../components/SEO';
import appsScriptApi from '../services/appsScriptApi';
import { auth, googleProvider, db } from '../services/firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';

export default function LoginPage() {
  const { onLoginSuccess, isAuthenticated, user } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab role selection: 'student' | 'teacher' | 'admin' | 'superadmin'
  const [selectedRole, setSelectedRole] = useState('student');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(() => {
    const msg = location.state?.message;
    if (msg && !msg.toLowerCase().includes('no longer valid') && !msg.toLowerCase().includes('expired')) {
      return { type: 'error', text: msg };
    }
    return null;
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const role = (user.role || '').toLowerCase();
      if (role.includes('admin') || role.includes('president') || role.includes('superadmin')) {
        navigate('/portal/admin', { replace: true });
      } else if (role === 'teacher') {
        navigate('/portal/teacher', { replace: true });
      } else {
        navigate('/portal/student', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);





  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userEmail = (result.user?.email || '').toLowerCase();
      
      let role = selectedRole === 'superadmin' ? 'SuperAdmin' : selectedRole === 'admin' ? 'Admin' : selectedRole === 'teacher' ? 'Teacher' : 'Student';
      let displayName = result.user?.displayName || userEmail;

      if (userEmail === 'adm.exam.hss.shangus@gmail.com') {
        role = 'SuperAdmin';
      } else {
        try {
          const userDocRef = doc(db, 'users', userEmail);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            role = userData.Role || userData.role || role;
            displayName = userData.Name || userData.name || displayName;
          }
        } catch (e) {
          console.warn('Firestore user fetch note:', e);
        }
      }

      const userSession = {
        email: userEmail,
        name: displayName,
        role: role,
        token: await result.user.getIdToken(),
      };

      setAlert({ type: 'success', text: 'Google Authentication successful! Redirecting...' });
      setTimeout(() => {
        onLoginSuccess(userSession, keepLoggedIn);
      }, 500);
    } catch (err) {
      console.error('Google Sign In Error:', err);
      setAlert({ type: 'error', text: err.message || 'Google Authentication failed.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e, isForceLogin = false) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setAlert({ type: 'error', text: 'Please enter both email address and password.' });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    const userEmailClean = email.trim().toLowerCase();
    const requiredRole = selectedRole === 'superadmin' ? 'president' : selectedRole;

    // NOTE: SuperAdmin email is authenticated through Firebase Auth like all other users.
    // Role assignment is handled after successful authentication in STEP 2.

    // ─── ⚡ STEP 2: Native Firebase Authentication & Auto-Provisioning ───
    try {
      let fbUser = null;

      // Try native Firebase Auth sign in
      try {
        const userCred = await signInWithEmailAndPassword(auth, userEmailClean, password);
        fbUser = userCred.user;
      } catch (authErr) {
        console.warn('Firebase Auth sign-in note (code:', authErr.code, '), checking Firestore user doc...');

        // Step 1: Look up account in Firestore ('users' collection)
        let firestoreUserDocRef = null;
        let firestoreUserData = null;

        try {
          const userDocRef = doc(db, 'users', userEmailClean);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            firestoreUserDocRef = userDocRef;
            firestoreUserData = userSnap.data();
          } else {
            let qSnap = await getDocs(query(collection(db, 'users'), where('email', '==', userEmailClean)));
            if (qSnap.empty) {
              qSnap = await getDocs(query(collection(db, 'users'), where('Email', '==', userEmailClean)));
            }
            if (!qSnap.empty) {
              firestoreUserDocRef = qSnap.docs[0].ref;
              firestoreUserData = qSnap.docs[0].data();
            }
          }
        } catch (e) {
          console.warn('Firestore fallback check note:', e);
        }

        if (firestoreUserData) {
          // Stored plain text password from previous legacy database structure
          const storedPlain = String(
            firestoreUserData.Password ||
            firestoreUserData.password ||
            firestoreUserData.pwd ||
            firestoreUserData.Pass ||
            ''
          ).trim();

          const enteredPass = password.trim();

          // Check if entered password matches the stored legacy plain password (or if stored plain is empty/not set)
          const isPlainMatch = storedPlain && (storedPlain === enteredPass);

          if (isPlainMatch) {
            // Instant Auto-Migration: Create Firebase Auth account with their remembered password!
            try {
              const newCred = await createUserWithEmailAndPassword(auth, userEmailClean, password);
              fbUser = newCred.user;

              // Clean up / flag migrated password in Firestore
              try {
                await setDoc(firestoreUserDocRef, { authProvisioned: true }, { merge: true });
              } catch (_) {}
            } catch (createErr) {
              if (createErr.code === 'auth/email-already-in-use') {
                setAlert({ type: 'error', text: 'Incorrect password. Please verify your credentials or click "Forgot Password" to reset.' });
                setIsLoading(false);
                return;
              } else {
                console.error('Auto-provision error:', createErr);
                setAlert({ type: 'error', text: createErr.message || 'Authentication error.' });
                setIsLoading(false);
                return;
              }
            }
          } else if (!storedPlain) {
            // Account is in Firestore, but no plain password field stored. Try provision with entered password if not in Auth yet
            if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
              try {
                const newCred = await createUserWithEmailAndPassword(auth, userEmailClean, password);
                fbUser = newCred.user;
                try {
                  await setDoc(firestoreUserDocRef, { authProvisioned: true }, { merge: true });
                } catch (_) {}
              } catch (createErr) {
                setAlert({ type: 'error', text: 'Incorrect password or credentials invalid. Use "Forgot Password" if needed.' });
                setIsLoading(false);
                return;
              }
            } else {
              setAlert({ type: 'error', text: 'Incorrect password. Please verify your credentials or click "Forgot Password".' });
              setIsLoading(false);
              return;
            }
          } else {
            // Password typed by student does NOT match the stored password
            setAlert({ type: 'error', text: 'Incorrect password. Please verify your credentials or click "Forgot Password" to reset.' });
            setIsLoading(false);
            return;
          }
        } else {
          setAlert({ type: 'error', text: 'No registered user found with this email address. Please register first.' });
          setIsLoading(false);
          return;
        }
      }

      // Fetch user profile info from Firestore
      let userRole = selectedRole === 'superadmin' ? 'SuperAdmin' : selectedRole === 'admin' ? 'Admin' : selectedRole === 'teacher' ? 'Teacher' : 'Student';
      let displayName = userEmailClean;

      try {
        const userDocRef = doc(db, 'users', userEmailClean);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          userRole = uData.Role || uData.role || userRole;
          displayName = uData.Name || uData.name || displayName;
        }
      } catch (e) {
        console.warn('Firestore profile load note:', e);
      }

      // Hardcoded SuperAdmin role guarantee — ensures the principal admin email
      // always receives SuperAdmin access regardless of Firestore role field
      if (userEmailClean === 'adm.exam.hss.shangus@gmail.com') {
        userRole = 'SuperAdmin';
        displayName = displayName === userEmailClean ? 'Sheikh Gulfam (SuperAdmin)' : displayName;
      }

      const token = fbUser ? await fbUser.getIdToken() : `token_${Date.now()}`;
      const userSession = {
        email: userEmailClean,
        name: displayName,
        role: userRole,
        uid: fbUser ? fbUser.uid : null,
        token: token,
      };

      setAlert({ type: 'success', text: 'Login successful! Redirecting...' });
      setTimeout(() => {
        onLoginSuccess({ success: true, user: userSession, token: userSession.token }, keepLoggedIn);
      }, 300);
      return;
    } catch (err) {
      console.error('Login error:', err);
      setAlert({ type: 'error', text: 'Invalid email address or password. Please verify your login credentials.' });
    } finally {
      setIsLoading(false);
    }
  };

  const isSuperAdmin = selectedRole === 'superadmin';

  return (
    <div className="w-full flex-1 py-6 sm:py-10 px-4 sm:px-6 flex flex-col items-center justify-center transition-colors duration-300" style={{ backgroundColor: 'var(--bg-page, #f5f3ff)' }}>
      <SEO
        title="Student & Staff Login Portal"
        description="Official Govt HSS Shangus Online Portal. Access admissions, roll slips, attendance tracking, and faculty utilities."
        path="/portal/login"
      />

      <div className="w-full max-w-sm sm:max-w-md md:max-w-md relative">
        {/* Ambient Glowing Background Orbs */}
        <div className={`absolute -top-12 -left-12 w-48 h-48 blur-3xl rounded-full pointer-events-none transition-all duration-500 ${
          isSuperAdmin ? 'bg-purple-500/20' : 'bg-teal-500/20'
        }`} />
        <div className={`absolute -bottom-12 -right-12 w-48 h-48 blur-3xl rounded-full pointer-events-none transition-all duration-500 ${
          isSuperAdmin ? 'bg-indigo-500/20' : 'bg-emerald-500/20'
        }`} />

        {/* Main Glassmorphism Modern Login Card */}
        <div 
          className={`rounded-3xl p-5 sm:p-6 border shadow-2xl transition-all duration-300 space-y-4 relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl ${
            isSuperAdmin ? 'border-purple-500/30 shadow-purple-500/10' : 'border-slate-200/80 dark:border-slate-800/80 shadow-teal-500/5'
          }`}
        >


          {/* Loading blur overlay — covers card content during sign-in */}
          {isLoading && (
            <div className="absolute inset-0 z-50 rounded-3xl flex flex-col items-center justify-center gap-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            >
              {/* Spinning logo */}
              <div className="relative flex items-center justify-center">
                {/* Outer spinning ring */}
                <div className="absolute w-20 h-20 rounded-full border-[3px] border-transparent animate-spin"
                  style={{ borderTopColor: isSuperAdmin ? '#7c3aed' : '#0d9488', borderRightColor: isSuperAdmin ? '#a78bfa40' : '#14b8a640', animationDuration: '0.9s' }}
                />
                {/* Inner pulsing ring */}
                <div className="absolute w-16 h-16 rounded-full border-2 border-dashed animate-spin opacity-50"
                  style={{ borderColor: isSuperAdmin ? '#7c3aed' : '#0d9488', animationDuration: '2s', animationDirection: 'reverse' }}
                />
                {/* School logo — fully opaque in centre */}
                <img src="/logo512.png" alt="HSS Shangus" className="w-10 h-10 object-contain relative z-10 drop-shadow-md" />
              </div>
              <p className="text-xs font-black tracking-widest uppercase" style={{ color: isSuperAdmin ? '#7c3aed' : '#0d9488' }}>
                Signing in...
              </p>
            </div>
          )}

          {/* Title Header — school logo + title */}
          <div className="relative z-10">
            {/* School logo — small, fully opaque, centred */}
            <div className="flex justify-center mb-3">
              <div className="relative">
                <img
                  src="/logo512.png"
                  alt="Govt HSS Shangus"
                  className="w-14 h-14 object-contain drop-shadow-lg"
                  style={{ opacity: 1 }}
                />
              </div>
            </div>
            <div className="flex items-start">
              {/* Spacer to balance the right button */}
              <div className="w-9 flex-shrink-0" />

              {/* Centered text block */}
              <div className="flex-1 text-center">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Login Portal
                </h1>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                  {isSuperAdmin ? 'Master Executive Authentication' : 'Select your workspace role to sign in'}
                </p>
                {isSuperAdmin && (
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-xs">
                    <Crown size={11} /> SuperAdmin Access Mode
                  </div>
                )}
              </div>

              {/* SuperAdmin Crown Toggle — right side */}
              <button
                type="button"
                onClick={() => setSelectedRole(isSuperAdmin ? 'admin' : 'superadmin')}
                title={isSuperAdmin ? 'Deactivate Superadmin Mode' : 'Superadmin Access'}
                className={`group relative flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer border ${
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
          </div>

          {/* Segmented Control Role Tabs */}
          <div className="grid grid-cols-3 p-1 rounded-2xl border text-xs font-black relative z-10 bg-slate-100/80 dark:bg-slate-950/80 border-slate-200/60 dark:border-slate-800/60 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setSelectedRole('student')}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                selectedRole === 'student'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25 font-black scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
              }`}
            >
              <GraduationCap size={14} /> Student
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('teacher')}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                selectedRole === 'teacher'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25 font-black scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
              }`}
            >
              <UserCheck size={14} /> Teacher
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole(isSuperAdmin ? 'superadmin' : 'admin')}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                selectedRole === 'admin' || isSuperAdmin
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-black scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
              }`}
            >
              <Lock size={14} /> Admin
            </button>
          </div>

          {/* Alert Notification Box */}
          {alert && (
            <div className={`p-3 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-fadeIn ${
              alert.type === 'error'
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              {alert.type === 'error' ? <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> : <CheckCircle size={15} className="flex-shrink-0 mt-0.5" />}
              <span>{alert.text}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {/* Email Address Input */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="login-email" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-all duration-200"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-4 pr-11 py-3 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer z-10 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Keep Logged In & Forgot Password */}
            <div className="flex items-center justify-between text-xs font-bold pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-500 dark:text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span>Keep me logged in</span>
              </label>

              <Link to="/portal/forgot-password" className="text-teal-600 dark:text-teal-400 hover:underline font-black">
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 rounded-xl font-black text-xs text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group ${
                isSuperAdmin
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/25'
                  : 'bg-teal-600 hover:bg-teal-500 shadow-teal-600/25'
              }`}
            >
              {isLoading ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
              )}
              <span>
                {isSuperAdmin ? 'Secure Login (SUPERADMIN)' : 'Sign In to Portal'}
              </span>
            </button>
          </form>

          {/* Social Google Login Section — no divider */}
          <div className="relative z-10">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-2 rounded-xl font-black text-xs border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>

          {/* Registration Footer Link */}
          <div className="text-center text-xs relative z-10 pt-0.5">
            <span className="text-slate-400 font-bold">Don't have an account? </span>
            <Link to="/portal/register" className="text-teal-600 dark:text-teal-400 font-black hover:underline">
              Create New Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
