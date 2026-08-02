import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import SEO from '../components/SEO';
import { db, auth } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [emailSent, setEmailSent] = useState(false);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Send Firebase Auth password reset email (secure, no plain-text storage)
  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    if (!email || !isEmailValid) {
      setAlert({ type: 'error', text: 'Please enter a valid registered email address.' });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      const emailClean = email.trim().toLowerCase();

      // Verify email exists in Firestore
      const userRef = doc(db, 'users', emailClean);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists() && emailClean !== 'adm.exam.hss.shangus@gmail.com') {
        setAlert({ type: 'error', text: 'No account found with this email address. Please check the email or register a new account.' });
        setIsLoading(false);
        return;
      }

      // Send Firebase Auth password reset email — NO plain-text passwords stored
      await sendPasswordResetEmail(auth, emailClean);
      setEmailSent(true);
      setAlert({ type: 'success', text: 'A password reset link has been sent to your email. Please check your inbox or spam folder.' });
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        // User exists in Firestore but not in Firebase Auth — send anyway silently
        setEmailSent(true);
        setAlert({ type: 'success', text: 'If an account exists with this email, a password reset link has been sent. Please check your inbox or spam folder.' });
      } else {
        setAlert({ type: 'error', text: err.message || 'Failed to send password reset email. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-10 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-page, #f5f3ff)' }}>
      <SEO
        title="Forgot Password | HSS Shangus Portal"
        description="Reset your student or faculty account password."
        path="/portal/forgot-password"
      />

      <div className="w-full max-w-md space-y-6">
        {/* Top Link */}
        <div className="flex items-center">
          <Link
            to="/portal/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
            style={{ color: 'var(--teal-accent, #0d9488)' }}
          >
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-3xl p-6 sm:p-8 border shadow-xl space-y-6" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
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
          {alert && (
            <div className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-fadeIn ${
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
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <Mail size={32} className="text-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-bold" style={{ color: 'var(--text-main, #0f172a)' }}>
                  Reset Link Sent!
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  We've sent a password reset link to <strong className="text-teal-600">{email}</strong>. 
                  Click the link in the email to set a new password. Please also check your <strong>spam folder</strong>.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setEmailSent(false); setAlert(null); }}
                  className="w-full py-3 rounded-2xl font-bold text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  style={{ color: 'var(--text-main, #334155)' }}
                >
                  <RefreshCw size={14} className="inline mr-1.5" />
                  Send Again / Try Different Email
                </button>
                <Link
                  to="/portal/login"
                  className="w-full py-3.5 rounded-2xl font-black text-xs text-white bg-teal-600 hover:bg-teal-500 shadow-lg transition-all flex items-center justify-center gap-2 text-center"
                >
                  <ArrowLeft size={14} />
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            /* Email input form */
            <form onSubmit={handleSendResetEmail} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Registered Email Address *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-teal-500"
                    style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl font-black text-xs text-white bg-teal-600 hover:bg-teal-500 shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
                <span>Send Password Reset Link</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
