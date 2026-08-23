import React, { useState, useEffect } from 'react';
import { useOutletContext, useLocation, Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Eye, EyeOff, Lock, User, GraduationCap, UserCheck, 
  AlertCircle, CheckCircle, ArrowRight, RefreshCw, Crown, Sparkles, 
  KeyRound, Mail, School, Award, CheckCircle2, ChevronRight, Compass
} from 'lucide-react';
import SEO from '../components/SEO';
import { auth, db, googleProvider } from '../services/firebase';
import { 
  getIdTokenResult, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut, 
  fetchSignInMethodsForEmail 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

  const createVerifiedSession = async (firebaseUser) => {
    const tokenResult = await getIdTokenResult(firebaseUser, true);
    const claims = tokenResult.claims || {};
    const emailLower = String(firebaseUser.email || '').toLowerCase().trim();
    const isBootstrapAdmin = emailLower === 'adm.exam.hss.shangus@gmail.com';

    const rawRole = String(
      claims.role || 
      (claims.admin ? 'Admin' : '') || 
      (isBootstrapAdmin ? 'SuperAdmin' : '') || 
      'Student'
    ).trim();

    const role = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
    const normalizedRole = role.toLowerCase();

    if ((normalizedRole.includes('admin') || normalizedRole === 'teacher' || normalizedRole === 'faculty') && !firebaseUser.emailVerified && !isBootstrapAdmin) {
      await signOut(auth).catch(() => {});
      throw new Error('Staff accounts must verify their email address before signing in.');
    }

    const selected = selectedRole === 'superadmin' ? 'superadmin' : selectedRole;
    const claimedArea = normalizedRole.includes('admin') ? 'admin'
      : normalizedRole === 'teacher' || normalizedRole === 'faculty' ? 'teacher'
      : 'student';

    if ((selected === 'admin' || selected === 'superadmin' || selected === 'teacher') && claimedArea === 'student') {
      await signOut(auth).catch(() => {});
      throw new Error(`This account is a Student account and cannot access the ${selected.toUpperCase()} portal.`);
    }

    return {
      user: {
        email: emailLower,
        name: firebaseUser.displayName || emailLower.split('@')[0],
        role,
        perms: Array.isArray(claims.permissions) ? claims.permissions : (isBootstrapAdmin ? ['*'] : []),
        photoURL: firebaseUser.photoURL || null,
        uid: firebaseUser.uid,
      },
      token: tokenResult.token,
    };
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const cleanEmail = String(fbUser.email || '').toLowerCase().trim();
      const displayName = fbUser.displayName || cleanEmail.split('@')[0];

      // Save demographic profile using UID as document ID
      // so student account is fully initialized with Student role in Firestore
      try {
        const userPayload = {
          uid: fbUser.uid,
          email: cleanEmail,
          name: displayName,
          mobile: fbUser.phoneNumber || '',
          requestedRole: 'Student',
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', fbUser.uid), userPayload, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore profile sync note:', fsErr);
      }

      const verifiedSession = await createVerifiedSession(fbUser);
      onLoginSuccess(verifiedSession, keepLoggedIn);
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setAlert({
          type: 'error',
          text: 'An account with this email address already exists. Please sign in with your email and password first, or reset your password to link your Google account.'
        });
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setAlert({ type: 'error', text: err.message || 'Google Sign-In failed. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

// Pure JS MD5 helper for verifying hashed passwords from Google Sheet / Firestore migrations
function md5(str) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX, lY) {
    var lX4, lY4, lX8, lY8, lResult;
    lX8 = (lX & 0x80000000); lY8 = (lY & 0x80000000);
    lX4 = (lX & 0x40000000); lY4 = (lY & 0x40000000);
    lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
      else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
    } else return (lResult ^ lX8 ^ lY8);
  }
  function F(x, y, z) { return (x & y) | ((~x) & z); }
  function G(x, y, z) { return (x & z) | (y & (~z)); }
  function H(x, y, z) { return (x ^ y ^ z); }
  function I(x, y, z) { return (y ^ (x | (~z))); }
  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function convertToWordArray(string) {
    var lWordCount;
    var lMessageLength = string.length;
    var lNumberOfWords_temp1 = lMessageLength + 8;
    var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    var lWordArray = Array(lNumberOfWords - 1);
    var lBytePosition = 0; var lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function wordToHex(lValue) {
    var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      WordToHexValue_temp = "0" + lByte.toString(16);
      WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
    }
    return WordToHexValue;
  }
  var x = convertToWordArray(str);
  var k, AA, BB, CC, DD, a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d;
    a = FF(a, b, c, d, x[k + 0], 7, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], 12, 0xE8C7B756); c = FF(c, d, a, b, x[k + 2], 17, 0x242070DB); b = FF(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
    a = FF(a, b, c, d, x[k + 4], 7, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], 12, 0x4787C62A); c = FF(c, d, a, b, x[k + 6], 17, 0xA8304613); b = FF(b, c, d, a, x[k + 7], 22, 0xFD469501);
    a = FF(a, b, c, d, x[k + 8], 7, 0x698098D8); d = FF(d, a, b, c, x[k + 9], 12, 0x8B44F7AF); c = FF(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
    a = FF(a, b, c, d, x[k + 12], 7, 0x6B901122); d = FF(d, a, b, c, x[k + 13], 12, 0xFD987193); c = FF(c, d, a, b, x[k + 14], 17, 0xA679438E); b = FF(b, c, d, a, x[k + 15], 22, 0x49B40821);
    a = GG(a, b, c, d, x[k + 1], 5, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], 9, 0xC040B340); c = GG(c, d, a, b, x[k + 11], 14, 0x265E5A51); b = GG(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
    a = GG(a, b, c, d, x[k + 5], 5, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], 9, 0x02441453); c = GG(c, d, a, b, x[k + 15], 14, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
    a = GG(a, b, c, d, x[k + 9], 5, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], 9, 0xC33707D6); c = GG(c, d, a, b, x[k + 3], 14, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], 20, 0x455A14ED);
    a = GG(a, b, c, d, x[k + 13], 5, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8); c = GG(c, d, a, b, x[k + 7], 14, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);
    a = HH(a, b, c, d, x[k + 5], 4, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], 11, 0x8771F681); c = HH(c, d, a, b, x[k + 11], 16, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
    a = HH(a, b, c, d, x[k + 1], 4, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], 11, 0x4BDECFA9); c = HH(c, d, a, b, x[k + 7], 16, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
    a = HH(a, b, c, d, x[k + 13], 4, 0x289B7EC6); d = HH(d, a, b, c, x[k + 0], 11, 0xEAA127FA); c = HH(c, d, a, b, x[k + 3], 16, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], 23, 0x04881D05);
    a = HH(a, b, c, d, x[k + 9], 4, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], 11, 0xE6DB99E5); c = HH(c, d, a, b, x[k + 15], 16, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], 23, 0xC4AC5665);
    a = II(a, b, c, d, x[k + 0], 6, 0xF4292244); d = II(d, a, b, c, x[k + 7], 10, 0x432AFF97); c = II(c, d, a, b, x[k + 14], 15, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], 21, 0xFC93A039);
    a = II(a, b, c, d, x[k + 12], 6, 0x655B59C3); d = II(d, a, b, c, x[k + 3], 10, 0x8F0CCC92); c = II(c, d, a, b, x[k + 10], 15, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], 21, 0x85845DD1);
    a = II(a, b, c, d, x[k + 8], 6, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0); c = II(c, d, a, b, x[k + 6], 15, 0xA3014314); b = II(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
    a = II(a, b, c, d, x[k + 4], 6, 0xF7537E82); d = II(d, a, b, c, x[k + 11], 10, 0xBD3AF235); c = II(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], 21, 0xEB86D391);
    a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

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
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const verifiedSession = await createVerifiedSession(userCred.user);

      setAlert({ type: 'success', text: 'Login successful! Redirecting...' });
      setTimeout(() => {
        onLoginSuccess(verifiedSession, keepLoggedIn);
      }, 400);

    } catch (err) {
      console.error('Login error:', err);
      let isGoogleOnly = false;

      // 1. Check sign in methods registered in Firebase Auth
      try {
        const methods = await fetchSignInMethodsForEmail(auth, cleanEmail);
        if (Array.isArray(methods) && methods.length > 0) {
          if (methods.includes('google.com') && !methods.includes('password')) {
            isGoogleOnly = true;
          }
        }
      } catch (mErr) {
        console.warn('Sign-in methods query note:', mErr);
      }

      // 2. Secondary fallback check in Firestore users collection
      if (!isGoogleOnly) {
        try {
          const userSnap = await getDoc(doc(db, 'users', cleanEmail));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.authProvider === 'google.com' || (Array.isArray(data.authProviders) && data.authProviders.includes('google.com') && !data.authProviders.includes('password'))) {
              isGoogleOnly = true;
            }
          }
        } catch (_) {}
      }

      if (isGoogleOnly) {
        setAlert({
          type: 'error',
          isGooglePrompt: true,
          email: cleanEmail,
          text: 'This account was registered using Google Sign-In and does not have a password set yet. Please click "Sign in with Google" below, or use "Reset Password" to set a password for email login.'
        });
      } else if (err.code === 'auth/too-many-requests') {
        setAlert({ type: 'error', text: 'Too many failed login attempts. Please try again later or reset your password.' });
      } else if (err.code === 'auth/network-request-failed') {
        setAlert({ type: 'error', text: 'Network error. Please check your internet connection.' });
      } else if (err.message && err.message.includes('portal')) {
        setAlert({ type: 'error', text: err.message });
      } else {
        setAlert({ type: 'error', text: 'Invalid email or password. Please check your credentials or reset your password.' });
      }
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
      features: ['System-wide Override Access', 'Administrative Module Management', 'Security & System Controls'],
      color: 'amber',
      icon: Crown,
    },
  };

  const activeRoleInfo = ROLE_DETAILS[selectedRole] || ROLE_DETAILS.student;
  const RoleIcon = activeRoleInfo.icon;

  return (
    <div className="portal-auth-page w-full min-h-[calc(100vh-var(--site-header-height,64px))] flex items-center justify-center py-6 px-3 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
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
            <div className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight uppercase">
              <span className="moving-gradient-subtle">Digital Student & Staff</span>{' '}
              <span className="moving-gradient-text">Portal</span>
            </div>
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
              Session 2025-26
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
                    <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Sign In
                    </h1>
                  </div>
                </div>

                {/* Cryptic SuperAdmin Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setSelectedRole(isSuperAdmin ? 'admin' : 'superadmin')}
                  title={isSuperAdmin ? 'Deactivate Executive Access' : 'System Mode'}
                  className="group relative flex-shrink-0 p-1.5 rounded-xl opacity-30 hover:opacity-100 transition-opacity cursor-pointer text-slate-400 hover:text-purple-500"
                >
                  <Sparkles size={14} className={isSuperAdmin ? 'text-purple-500 opacity-100' : ''} />
                  {isSuperAdmin && (
                    <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  )}
                </button>
              </div>

              {isSuperAdmin && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 w-full justify-center">
                  <ShieldCheck size={13} /> SuperAdmin Access Mode Active
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

            {/* Alert Banner */}
            {alert && (
              <div className={`p-3.5 rounded-2xl text-xs font-bold flex flex-col gap-2.5 mb-4 animate-fadeIn relative z-10 ${
                alert.type === 'error' 
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400' 
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              }`}>
                <div className="flex items-start gap-2.5">
                  {alert.type === 'error' ? <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> : <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />}
                  <span>{alert.text}</span>
                </div>

                {alert.isGooglePrompt && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-500/20">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-black text-[11px] shadow-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>Sign in with Google</span>
                    </button>
                    <Link
                      to={`/portal/forgot-password?email=${encodeURIComponent(alert.email || email)}`}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px] shadow-xs flex items-center gap-1"
                    >
                      <KeyRound size={12} />
                      <span>Reset Password</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Main Login Form */}
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
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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

              {/* Main Submit CTA Button with Attention-Grabbing Pulse & Animated Arrow */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm text-white shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] group animate-portal-pulse ${
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
                    <ArrowRight size={16} className="animate-bounce-x" />
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
