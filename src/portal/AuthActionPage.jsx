import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, Check, CheckCircle2, Eye, EyeOff,
  KeyRound, Loader2, LockKeyhole, MailCheck, RefreshCw, ShieldCheck,
} from 'lucide-react';
import {
  applyActionCode, checkActionCode, confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import SEO from '../components/SEO';
import { auth } from '../services/firebase';

function maskEmail(value) {
  const [local, domain] = String(value || '').split('@');
  if (!local || !domain) return 'your account';
  return `${local.slice(0, Math.min(2, local.length))}${'•'.repeat(Math.min(5, Math.max(3, local.length - 2)))}@${domain}`;
}

function PasswordRequirement({ met, children }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? 'text-emerald-600' : 'text-slate-400'}`}>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full ${met ? 'bg-emerald-100' : 'bg-slate-100'}`}>
        <Check size={10} strokeWidth={3} />
      </span>
      {children}
    </li>
  );
}

export default function AuthActionPage() {
  const location = useLocation();

  // Extract query parameters from search or hash fragment (some email clients or Firebase rewrites place params in hash)
  const params = useMemo(() => {
    let p = new URLSearchParams(location.search || window.location.search);
    if (!p.get('oobCode')) {
      const rawHash = location.hash || window.location.hash || '';
      const hashStr = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
      const hashQuery = hashStr.includes('?') ? hashStr.slice(hashStr.indexOf('?') + 1) : hashStr;
      const hashParams = new URLSearchParams(hashQuery);
      if (hashParams.get('oobCode')) {
        p = hashParams;
      }
    }
    return p;
  }, [location.search, location.hash]);

  const mode = params.get('mode') || '';
  const actionCode = params.get('oobCode') || '';

  const [status, setStatus] = useState('checking'); // 'checking' | 'reset-ready' | 'submitting' | 'reset-complete' | 'verified' | 'recovered' | 'invalid' | 'network-error'
  const [accountEmail, setAccountEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  // Ref guard to prevent double-firing in React 18 StrictMode
  const hasVerifiedRef = useRef(false);

  // Practical, robust password rules for school faculty
  const passwordChecks = {
    length: newPassword.length >= 8,
    hasLetter: /[a-zA-Z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  useEffect(() => {
    let active = true;

    async function validateAction() {
      if (!actionCode || !['resetPassword', 'verifyEmail', 'recoverEmail'].includes(mode)) {
        if (active) {
          setMessage('No valid action code was provided in this link. Please request a new link.');
          setStatus('invalid');
        }
        return;
      }

      if (hasVerifiedRef.current) return;

      try {
        if (mode === 'resetPassword') {
          const email = await verifyPasswordResetCode(auth, actionCode);
          hasVerifiedRef.current = true;
          if (active) {
            setAccountEmail(email);
            setStatus('reset-ready');
            setMessage('');
          }
          return;
        }

        if (mode === 'verifyEmail') {
          await applyActionCode(auth, actionCode);
          hasVerifiedRef.current = true;
          if (active) setStatus('verified');
          return;
        }

        const info = await checkActionCode(auth, actionCode);
        await applyActionCode(auth, actionCode);
        hasVerifiedRef.current = true;
        if (active) {
          setAccountEmail(info?.data?.email || '');
          setStatus('recovered');
        }
      } catch (err) {
        console.warn('Action verification error:', err);
        if (!active) return;

        if (err?.code === 'auth/expired-action-code') {
          setMessage('This password reset link has expired (links expire after 1 hour for your account security). Please request a fresh link below.');
          setStatus('invalid');
        } else if (err?.code === 'auth/invalid-action-code') {
          setMessage('This password reset link is invalid or has already been used. If you have already updated your password, you can sign in directly.');
          setStatus('invalid');
        } else if (err?.code === 'auth/network-request-failed') {
          setMessage('Network connection issue. Please check your internet connection and click Retry.');
          setStatus('network-error');
        } else {
          setMessage(err?.message || 'The secure link could not be verified. Please request a new link.');
          setStatus('invalid');
        }
      }
    }

    validateAction();
    return () => { active = false; };
  }, [actionCode, mode]);

  async function handlePasswordReset(event) {
    event.preventDefault();
    setMessage('');

    if (!passwordValid) {
      setMessage('Password must be at least 8 characters long and contain both letters and numbers.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('The passwords do not match. Please re-enter them.');
      return;
    }

    setStatus('submitting');
    try {
      await confirmPasswordReset(auth, actionCode, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setStatus('reset-complete');
    } catch (err) {
      console.warn('confirmPasswordReset error:', err);

      if (err?.code === 'auth/expired-action-code') {
        setMessage('This password reset link has expired. Please request a fresh link.');
        setStatus('invalid');
      } else if (err?.code === 'auth/invalid-action-code') {
        setMessage('This reset code has already been used or is no longer valid. Please request a fresh link.');
        setStatus('invalid');
      } else if (err?.code === 'auth/weak-password') {
        setMessage('The chosen password is too weak. Please use a stronger password with letters and numbers.');
        setStatus('reset-ready'); // Retain password form so user can fix password without being locked out!
      } else if (err?.code === 'auth/network-request-failed') {
        setMessage('Network connection lost. Please check your internet and click Save New Password again.');
        setStatus('reset-ready');
      } else {
        setMessage(err?.message || 'Failed to update password. Please try again.');
        setStatus('reset-ready');
      }
    }
  }

  const isChecking = status === 'checking';
  const isSuccess = ['reset-complete', 'verified', 'recovered'].includes(status);
  const title = status === 'reset-ready' || status === 'submitting' ? 'Create a New Password'
    : status === 'reset-complete' ? 'Password Updated'
      : status === 'verified' ? 'Email Verified'
        : status === 'recovered' ? 'Email Restored'
          : status === 'invalid' ? 'Link Expired or Already Used'
            : status === 'network-error' ? 'Connection Issue'
              : 'Checking Secure Link';

  return (
    <div className="portal-auth-page w-full flex-1 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-10" style={{ backgroundColor: 'var(--bg-page, #f5f3ff)' }}>
      <SEO title={`${title} | HSS Shangus Portal`} description="Secure account action for the HSS Shangus portal." path="/portal/auth/action" />
      <main className="w-full max-w-md overflow-hidden rounded-3xl border bg-white shadow-xl" style={{ borderColor: 'var(--border-ui, #e2e8f0)', backgroundColor: 'var(--bg-card, #fff)' }}>
        <div className="h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
        <div className="p-5 sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 ring-8 ring-teal-500/5">
              {isChecking ? <Loader2 size={27} className="animate-spin" />
                : isSuccess ? <CheckCircle2 size={28} />
                  : (status === 'invalid' || status === 'network-error') ? <AlertCircle size={28} className="text-amber-600" />
                    : <LockKeyhole size={28} />}
            </div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-teal-600">HSS Shangus Secure Account</p>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-main, #0f172a)' }}>{title}</h1>
            {accountEmail && <p className="mt-2 text-xs text-slate-400">Account: <strong className="text-slate-600">{maskEmail(accountEmail)}</strong></p>}
          </div>

          {isChecking && (
            <div className="space-y-3 text-center py-4">
              <Loader2 size={24} className="mx-auto animate-spin text-teal-600" />
              <p role="status" className="text-sm font-medium text-slate-500">Validating your one-time secure link…</p>
            </div>
          )}

          {(status === 'reset-ready' || status === 'submitting') && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              {message && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {message}
                </div>
              )}
              <div>
                <label htmlFor="auth-action-password" className="mb-1 block text-xs font-bold text-slate-600">New Password</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    id="auth-action-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full rounded-2xl border border-slate-200 pl-10 pr-11 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 rounded-lg p-1 text-slate-400 hover:text-teal-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="auth-action-confirm-password" className="mb-1 block text-xs font-bold text-slate-600">Confirm Password</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    id="auth-action-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full rounded-2xl border border-slate-200 pl-10 pr-4 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    required
                  />
                </div>
              </div>
              <ul className="grid grid-cols-3 gap-2 text-[11px] font-semibold py-1">
                <PasswordRequirement met={passwordChecks.length}>8+ characters</PasswordRequirement>
                <PasswordRequirement met={passwordChecks.hasLetter}>Letters</PasswordRequirement>
                <PasswordRequirement met={passwordChecks.hasNumber}>Numbers</PasswordRequirement>
              </ul>
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3 text-xs font-black text-white shadow-lg shadow-teal-500/25 hover:bg-teal-500 disabled:opacity-50 cursor-pointer transition-all active:scale-[0.98]"
              >
                {status === 'submitting' ? <Loader2 size={15} className="animate-spin" /> : <LockKeyhole size={15} />}
                <span>{status === 'submitting' ? 'Updating Password…' : 'Save New Password'}</span>
              </button>
            </form>
          )}

          {status === 'invalid' && (
            <div className="space-y-4 text-center">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 leading-relaxed">
                {message || 'This secure link is invalid, has expired, or was already used.'}
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
                <Link
                  to={`/portal/forgot-password${accountEmail ? `?email=${encodeURIComponent(accountEmail)}` : ''}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-teal-500 cursor-pointer"
                >
                  <RefreshCw size={14} /> Request a Fresh Link
                </Link>
                <Link
                  to="/portal/login"
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <ArrowLeft size={14} /> Go to Login
                </Link>
              </div>
            </div>
          )}

          {status === 'network-error' && (
            <div className="space-y-4 text-center">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-900 leading-relaxed">
                {message || 'Network connection issue while verifying your link.'}
              </div>
              <button
                type="button"
                onClick={() => {
                  hasVerifiedRef.current = false;
                  setStatus('checking');
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-teal-500 cursor-pointer"
              >
                <RefreshCw size={14} /> Retry Verification
              </button>
            </div>
          )}

          {isSuccess && (
            <div className="space-y-4 text-center">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-800">
                {status === 'reset-complete' && 'Your password has been updated successfully. You can now sign in with your new password.'}
                {status === 'verified' && 'Your email is verified. Staff and administrator permissions can now be used securely.'}
                {status === 'recovered' && 'Your account email has been restored. Reset your password if you did not request the earlier change.'}
              </div>
              <Link to="/portal/login" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3.5 text-xs font-black text-white shadow-lg hover:bg-teal-500 cursor-pointer">
                <MailCheck size={16} /> Continue to Login
              </Link>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-4 text-[10px] font-semibold text-slate-400">
            <ShieldCheck size={13} className="text-teal-500" /> Protected by Encrypted Cloud Authentication
          </div>
        </div>
      </main>
    </div>
  );
}
