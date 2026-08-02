import React, { useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, User, Lock, Mail, Phone, Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, RefreshCw, GraduationCap, UserCheck, BookOpen, Layers, Briefcase, Calendar } from 'lucide-react';

import SEO from '../components/SEO';
import { auth, db } from '../services/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Master List of Official School Subjects
const MASTER_SUBJECTS = [
  'General English',
  'Physics',
  'Chemistry',
  'Biology',
  'Botany',
  'Zoology',
  'Environmental Science',
  'Physical Education',
  'IT And ITES',
  'Healthcare',
  'Computer Science',
  'Geography',
  'Mathematics',
  'Urdu',
  'Education',
  'History',
  'Political Science',
  'Economics',
  'Sociology',
  'Psychology',
  'Accountancy',
  'Business Studies',
  'Entrepreneurship',
  'Arabic',
  'Persian',
];

export default function RegisterPage() {
  const { onLoginSuccess } = useOutletContext();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState('Student'); // 'Student' | 'Teacher' | 'Admin'

  // General Form Fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Teacher / Faculty Specific Fields
  const [teacherClass, setTeacherClass] = useState('11th & 12th Class');
  const [teacherSubject, setTeacherSubject] = useState('Physics');
  const [teacherDesignation, setTeacherDesignation] = useState('Lecturer');

  // Academic session — default to current/next academic year
  const currentYear = new Date().getFullYear();
  const sessionOptions = [
    `${currentYear - 1}-${String(currentYear).slice(-2)}`,
    `${currentYear}-${String(currentYear + 1).slice(-2)}`,
    `${currentYear + 1}-${String(currentYear + 2).slice(-2)}`,
  ];
  const [academicSession, setAcademicSession] = useState(sessionOptions[1]);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'Admin') {
      setAlert({
        type: 'error',
        text: 'Admin account creation is restricted and managed internally by the Institution Administration. Public Admin registration is disabled.',
      });
    } else {
      setAlert(null);
    }
  };

  // Step 1: Submit Details & Verify Account Availability
  const handleDetailsSubmit = async (e) => {
    e.preventDefault();

    if (role === 'Admin') {
      setAlert({
        type: 'error',
        text: 'Admin account creation is restricted and managed internally by the Institution Administration. Public Admin registration is disabled.',
      });
      return;
    }

    if (!email || !name) {
      setAlert({ type: 'error', text: 'Please fill in required fields (Name & Email).' });
      return;
    }

    if (role === 'Teacher' && (!teacherClass || !teacherSubject)) {
      setAlert({ type: 'error', text: 'Please select your assigned Class and teaching Subject.' });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      const userEmailClean = email.trim().toLowerCase();

      // Check if user already exists
      try {
        const userDocRef = doc(db, 'users', userEmailClean);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          setAlert({ type: 'error', text: 'An account with this email address already exists. Please log in.' });
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn('User lookup note:', e);
      }

      // ── Teacher uniqueness check ─────────────────────────────────────────────
      // One teacher per subject+class combination per academic session.
      if (role === 'Teacher') {
        try {
          const q = query(
            collection(db, 'users'),
            where('role', '==', 'Teacher'),
            where('assignedClass', '==', teacherClass),
            where('teachingSubject', '==', teacherSubject),
            where('academicSession', '==', academicSession)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setAlert({
              type: 'error',
              text: `A teacher is already registered for "${teacherSubject}" in "${teacherClass}" for the ${academicSession} session. Each subject-class combination can only have one registered teacher per session. Please contact the administration if this is incorrect.`,
            });
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Teacher uniqueness check note:', e);
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      setStep(2);
    } catch (err) {
      console.error('Registration validation error:', err);
      setAlert({ type: 'error', text: err.message || 'Validation failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Set Password & Create Account
  const handleRegister = async (e) => {
    e.preventDefault();

    if (role === 'Admin') {
      setAlert({
        type: 'error',
        text: 'Admin account creation is restricted and managed internally by the Institution Administration.',
      });
      return;
    }

    if (!password || password.length < 6) {
      setAlert({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    if (password !== confirmPassword) {
      setAlert({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    const userEmailClean = email.trim().toLowerCase();

    try {
      // 1. Create Firebase Auth user
      let userCred = null;
      try {
        userCred = await createUserWithEmailAndPassword(auth, userEmailClean, password);
        await updateProfile(userCred.user, { displayName: name.trim() });
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          setAlert({ type: 'error', text: 'An account with this email address already exists. Please log in.' });
          setIsLoading(false);
          return;
        } else {
          console.warn('Firebase Auth user creation note:', authErr);
        }
      }

      // 2. Save user account record in Firestore ('users' collection)
      // NOTE: Passwords are NEVER stored in Firestore — Firebase Auth handles authentication.
      const userDocRef = doc(db, 'users', userEmailClean);
      const userData = {
        email: userEmailClean,
        Email: userEmailClean,
        name: name.trim(),
        Name: name.trim(),
        mobile: mobile.trim(),
        Mobile: mobile.trim(),
        role: role,
        Role: role,
        uid: userCred ? userCred.user.uid : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (role === 'Teacher') {
        userData.assignedClass = teacherClass;
        userData.teachingSubject = teacherSubject;
        userData.designation = teacherDesignation;
        userData.academicSession = academicSession;
      }

      await setDoc(userDocRef, userData, { merge: true });

      setAlert({ type: 'success', text: 'Account created successfully! Redirecting to workspace...' });

      const newSession = {
        success: true,
        user: {
          email: userEmailClean,
          name: name.trim(),
          role: role,
          mobile: mobile.trim(),
          assignedClass: role === 'Teacher' ? teacherClass : '',
          teachingSubject: role === 'Teacher' ? teacherSubject : '',
          designation: role === 'Teacher' ? teacherDesignation : '',
          academicSession: role === 'Teacher' ? academicSession : '',
        },
        token: `token_reg_${Date.now()}`,
      };

      setTimeout(() => {
        onLoginSuccess(newSession, true);
        navigate(role === 'Teacher' ? '/portal/teacher' : '/portal/student');
      }, 1000);
    } catch (err) {
      console.error('Registration failed:', err);
      setAlert({ type: 'error', text: 'Failed to create account. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex-1 py-8 sm:py-12 px-4 sm:px-6 flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--bg-page, #f5f3ff)' }}>
      <SEO
        title="Create Portal Account"
        description="Register for Govt HSS Shangus student or faculty portal account."
        path="/portal/register"
      />

      <div className="w-full max-w-md space-y-6">
        {/* Main Card */}
        <div
          key={step}
          className="rounded-3xl p-6 sm:p-8 border shadow-xl space-y-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          style={{
            animation: 'registerFadeSlide 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
        >
          <style>{`
            @keyframes registerFadeSlide {
              from { opacity: 0; transform: translateY(18px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div className="flex justify-between items-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-teal-500/10 text-teal-600 border border-teal-500/20">
              <ShieldCheck size={14} />
              <span>Govt. HSS Shangus</span>
            </div>
            <span className="text-xs font-black text-slate-400">Step {step} of 2</span>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              CREATE ACCOUNT
            </h1>
            <p className="text-xs font-bold text-slate-400">
              {step === 1 ? 'Select your role and enter your details' : 'Set up password for your portal account'}
            </p>
          </div>

          {/* Role Switcher */}
          {step === 1 && (
            <div className="grid grid-cols-3 p-1 rounded-2xl border text-xs font-bold bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleRoleChange('Student')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  role === 'Student' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <GraduationCap size={14} /> Student
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('Teacher')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  role === 'Teacher' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <UserCheck size={14} /> Teacher
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('Admin')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer opacity-70 ${
                  role === 'Admin' ? 'bg-rose-600 text-white shadow-sm opacity-100' : 'text-slate-600 dark:text-slate-400'
                }`}
                title="Admin registration is restricted"
              >
                <Lock size={14} /> Admin
              </button>
            </div>
          )}

          {alert && (
            <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-fadeIn ${
              alert.type === 'error'
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
            }`}>
              {alert.type === 'error' ? <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> : <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />}
              <span>{alert.text}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mobile Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Additional Teacher / Faculty Registration Fields */}
              {role === 'Teacher' && (
                <div className="space-y-3.5 pt-2 border-t border-slate-200 dark:border-slate-800 animate-fadeIn">
                  <div className="text-[11px] font-black uppercase text-teal-600 dark:text-teal-400 tracking-wider flex items-center gap-1">
                    <UserCheck size={13} /> Faculty Specialization Details
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Assigned Class / Grade *</label>
                    <div className="relative">
                      <Layers size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <select
                        value={teacherClass}
                        onChange={(e) => setTeacherClass(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white cursor-pointer"
                      >
                        <option value="11th Class">11th Class</option>
                        <option value="12th Class">12th Class</option>
                        <option value="11th & 12th Class">11th & 12th Class (Higher Secondary)</option>
                        <option value="10th Class">10th Class</option>
                        <option value="9th Class">9th Class</option>
                        <option value="All Classes">All Secondary & Higher Secondary Classes</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Teaching Subject *</label>
                    <div className="relative">
                      <BookOpen size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <select
                        value={teacherSubject}
                        onChange={(e) => setTeacherSubject(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white cursor-pointer"
                      >
                        {MASTER_SUBJECTS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Designation / Role</label>
                    <div className="relative">
                      <Briefcase size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <select
                        value={teacherDesignation}
                        onChange={(e) => setTeacherDesignation(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white cursor-pointer"
                      >
                        <option value="Lecturer">Lecturer</option>
                        <option value="Senior Lecturer">Senior Lecturer</option>
                        <option value="Teacher">Teacher</option>
                        <option value="Master">Master</option>
                        <option value="Physical Education Master">Physical Education Master</option>
                        <option value="Vocational Instructor">Vocational Instructor</option>
                      </select>
                    </div>
                  </div>

                  {/* Academic Session */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Academic Session *</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <select
                        value={academicSession}
                        onChange={(e) => setAcademicSession(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white cursor-pointer"
                      >
                        {sessionOptions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                      ⚠ Only one teacher may be registered per subject-class-session combination.
                    </p>
                  </div>
                </div>
              )}


              <button
                type="submit"
                disabled={isLoading || role === 'Admin'}
                className="w-full py-3.5 rounded-2xl font-black text-xs text-white bg-teal-600 hover:bg-teal-500 shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                <span>
                  {role === 'Admin' ? 'Admin Registration Disabled' : 'Continue to Password Setup'}
                </span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Create Password *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirm Password *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-3.5 rounded-2xl font-extrabold text-xs border border-slate-300 text-slate-600 hover:bg-slate-100"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-2/3 py-3.5 rounded-2xl font-black text-xs text-white bg-teal-600 hover:bg-teal-500 shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>Complete Registration</span>
                </button>
              </div>
            </form>
          )}

          <div className="text-center text-xs pt-2">
            <span className="text-slate-400 font-bold">Already have an account? </span>
            <Link to="/portal/login" className="text-teal-600 font-extrabold hover:underline">
              Sign In Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
