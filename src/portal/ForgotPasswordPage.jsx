import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import SEO from '../components/SEO';
import { auth } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { checkEmailRateLimit, recordEmailSent, getRemainingCooldown } from '../utils/emailRateLimiter';

function maskEmailAddress(value) {
  const [localPart, domain] = String(value || '').trim().split('@');
  if (!localPart || !domain) return 'your registered email';
  const visible = localPart.length <= 2 ? localPart.slice(0, 1) : localPart.slice(0, 2);
  return `${visible}${'•'.repeat(Math.min(5, Math.max(3, localPart.length - visible.length)))}@${domain}`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('email') || '';
    } catch (_) {
      return '';
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  useEffect(() => {
    if (email && isEmailValid) {
      const rem = getRemainingCooldown('password_reset', email.trim().toLowerCase(), 60);
      setCooldown(rem);
    }
  }, [email, isEmailValid]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Send Firebase Auth password reset email (secure, rate-limited, no plain-text storage)
  const handleSendResetEmail = async (e) => {
    if (e) e.preventDefault();
    if (!email || !isEmailValid) {
      setAlert({ type: 'error', text: 'Please enter a valid registered email address.' });
      return;
    }

    const emailClean = email.trim().toLowerCase();

    // 1. Check rate limits (60s cooldown + 4 daily limit per email)
    const rateCheck = checkEmailRateLimit('password_reset', emailClean, { cooldownSeconds: 60, maxDaily: 4 });
    if (!rateCheck.allowed) {
      setAlert({ type: 'error', text: rateCheck.message });
      if (rateCheck.remainingCooldown > 0) {
        setCooldown(rateCheck.remainingCooldown);
      }
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      // Send Firebase Auth password reset email — NO plain-text passwords stored
      await sendPasswordResetEmail(auth, emailClean, {
        url: `${window.location.origin}/portal/login`,
        handleCodeInApp: false,
      });

      recordEmailSent('password_reset', emailClean);
      setCooldown(60);
      setEmailSent(true);
      setAlert({ type: 'success', text: 'If an account exists, a password reset link has been sent. Please check your inbox or spam folder.' });
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        // User not found in Firebase Auth — send anyway silently for security & avoid account enumeration
        recordEmailSent('password_reset', emailClean);
        setCooldown(60);
        setEmailSent(true);
        setAlert({ type: 'success', text: 'If an account exists with this email, a password reset link has been sent. Please check your inbox or spam folder.' });
      } else if (err.code === 'auth/too-many-requests' || err.code === 'auth/quota-exceeded') {
        setAlert({ type: 'error', text: 'Too many reset requests have been made. Please wait 15 minutes before trying again.' });
      } else {
        setAlert({ type: 'error', text: err.message || 'Failed to send password reset email. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="portal-auth-page w-full flex-1 flex flex-col items-center justify-center py-6 sm:py-10 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-page, #f5f3ff)' }}>
      <SEO
        title="Forgot Password | HSS Shangus Portal"
        description="Reset your student or faculty account password."
        path="/portal/forgot-password"
      />

      <div className="w-full max-w-md space-y-4 sm:space-y-6">
        {/* Top Link */}
        {!emailSent && <div className="flex items-center">
          <Link
            to="/portal/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
            style={{ color: 'var(--teal-accent, #0d9488)' }}
          >
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </div>}

        {/* Card */}
        <div className="rounded-3xl p-5 sm:p-8 border shadow-xl space-y-5 sm:space-y-6" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-teal-500/10 text-teal-600 shadow-sm">
              <Lock size={28} />
            </div>
            <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-main, #0f172a)' }}>
              Reset Password
            </h1>
            <p className="text-xs text-slate-400">
              {emailSent ? 'Check your email for the reset link' : 'Enter your registered email address to receive a password reset link'}
            </p>
          </div>

          {/* Alert */}
          {alert && !emailSent && (
            <div role="alert" aria-live="polite" className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-fadeIn ${
              alert.type === 'error'
                ? 'bg-red-500/10 border border-red-500/30 text-red-600'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
            }`}>
              {alert.type === 'error' ? <AlertCircle size={16} className="flex-shrink-0" /> : <CheckCircle size={16} className="flex-shrink-0" />}
              <span>{alert.text}</span>
            </div>
          )}

          {/* Email sent success state */}
          {emailSent ? (
            <div className="space-y-4 text-center" role="status" aria-live="polite">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 ring-8 ring-emerald-500/5 flex items-center justify-center mx-auto">
                <Mail size={28} className="text-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-bold" style={{ color: 'var(--text-main, #0f172a)' }}>
                  Check your inbox
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  If an account exists, a secure reset link has been sent to <strong className="text-teal-600">{maskEmailAddress(email)}</strong>.
                  Check your inbox and spam folder, then choose a new password.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-[11px] leading-relaxed text-amber-800">
                <strong>Security reminder:</strong> never share the reset link or verification code with anyone, including school staff.
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  disabled={isLoading || cooldown > 0}
                  onClick={() => handleSendResetEmail(null)}
                  className="w-full py-2.5 rounded-2xl font-bold text-xs border border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Mail size={14} />
                  <span>{cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend Reset Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setEmailSent(false); setAlert(null); }}
                  className="w-full py-2.5 rounded-2xl font-bold text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  style={{ color: 'var(--text-main, #334155)' }}
                >
                  <RefreshCw size={14} className="inline mr-1.5" />
                  Use a different email
                </button>
                <Link
                  to="/portal/login"
                  className="w-full py-3 rounded-2xl font-black text-xs text-white bg-teal-600 hover:bg-teal-500 shadow-lg transition-all flex items-center justify-center gap-2 text-center"
                >
                  <ArrowLeft size={14} />
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            /* Email input form */
            <form onSubmit={handleSendResetEmail} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label htmlFor="reset-email" className="block text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                  Registered Email Address <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative group">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 dark:group-focus-within:text-teal-400 transition-colors pointer-events-none" />
                  <input
                    id="reset-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-[13.5px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15 dark:focus:ring-teal-500/25 transition-all duration-150"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-md shadow-teal-700/20 hover:shadow-lg hover:shadow-teal-700/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] mt-3"
              >
                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
                <span>{isLoading ? 'Sending secure link…' : 'Send Password Reset Link'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
