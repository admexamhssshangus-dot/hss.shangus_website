import React, { useEffect, useMemo, useState } from 'react';
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
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const mode = params.get('mode') || '';
  const actionCode = params.get('oobCode') || '';
  const [status, setStatus] = useState('checking');
  const [accountEmail, setAccountEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const passwordChecks = {
    length: newPassword.length >= 12,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  useEffect(() => {
    let active = true;
    async function validateAction() {
      if (!actionCode || !['resetPassword', 'verifyEmail', 'recoverEmail'].includes(mode)) {
        if (active) setStatus('invalid');
        return;
      }
      try {
        if (mode === 'resetPassword') {
          const email = await verifyPasswordResetCode(auth, actionCode);
          if (active) {
            setAccountEmail(email);
            setStatus('reset-ready');
          }
          return;
        }
        if (mode === 'verifyEmail') {
          await applyActionCode(auth, actionCode);
          if (active) setStatus('verified');
          return;
        }
        const info = await checkActionCode(auth, actionCode);
        await applyActionCode(auth, actionCode);
        if (active) {
          setAccountEmail(info?.data?.email || '');
          setStatus('recovered');
        }
      } catch (_) {
        if (active) setStatus('invalid');
      }
    }
    validateAction();
    return () => { active = false; };
  }, [actionCode, mode]);

  async function handlePasswordReset(event) {
    event.preventDefault();
    setMessage('');
    if (!passwordValid) {
      setMessage('Use at least 12 characters with uppercase, lowercase, and a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('The passwords do not match.');
      return;
    }
    setStatus('submitting');
    try {
      await confirmPasswordReset(auth, actionCode, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setStatus('reset-complete');
    } catch (_) {
      setStatus('invalid');
    }
  }

  const isChecking = status === 'checking';
  const isSuccess = ['reset-complete', 'verified', 'recovered'].includes(status);
  const title = status === 'reset-ready' || status === 'submitting' ? 'Create a New Password'
    : status === 'reset-complete' ? 'Password Updated'
      : status === 'verified' ? 'Email Verified'
        : status === 'recovered' ? 'Email Restored'
          : status === 'invalid' ? 'Link Expired or Already Used'
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
                  : status === 'invalid' ? <AlertCircle size={28} className="text-amber-600" />
                    : <LockKeyhole size={28} />}
            </div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-teal-600">HSS Shangus Secure Account</p>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-main, #0f172a)' }}>{title}</h1>
            {accountEmail && <p className="mt-2 text-xs text-slate-400">Account: <strong className="text-slate-600">{maskEmail(accountEmail)}</strong></p>}
          </div>

          {isChecking && <p role="status" className="text-center text-sm text-slate-500">Validating this one-time secure link…</p>}

          {(status === 'reset-ready' || status === 'submitting') && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              {message && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{message}</div>}
              <div>
                <label htmlFor="auth-action-password" className="mb-1 block text-xs font-bold text-slate-600">New Password</label>
                <input
                  id="auth-action-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  required
                />
              </div>
              <div>
                <label htmlFor="auth-action-confirm-password" className="mb-1 block text-xs font-bold text-slate-600">Confirm Password</label>
                <input
                  id="auth-action-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  required
                />
              </div>
              <ul className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
                <PasswordRequirement met={passwordChecks.length}>12+ characters</PasswordRequirement>
                <PasswordRequirement met={passwordChecks.upper}>Uppercase letter</PasswordRequirement>
                <PasswordRequirement met={passwordChecks.lower}>Lowercase letter</PasswordRequirement>
                <PasswordRequirement met={passwordChecks.number}>Number</PasswordRequirement>
              </ul>
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3 text-xs font-black text-white shadow-lg shadow-teal-500/25 hover:bg-teal-500 disabled:opacity-50"
              >
                {status === 'submitting' ? <Loader2 size={15} className="animate-spin" /> : <LockKeyhole size={15} />}
                <span>{status === 'submitting' ? 'Updating Password…' : 'Save New Password'}</span>
              </button>
            </form>
          )}

          {status === 'invalid' && (
            <div className="space-y-4 text-center">
              <p className="text-xs text-slate-500">{message || 'This secure link is invalid or has expired.'}</p>
              <Link to="/portal/forgot-password" className="inline-flex items-center gap-1.5 rounded-2xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-teal-500">
                Request New Link
              </Link>
            </div>
          )}

          {isSuccess && (
            <div className="space-y-4 text-center">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-800">
                {status === 'reset-complete' && 'Your password has been updated successfully. Sign in with your new password.'}
                {status === 'verified' && 'Your email is verified. Staff and administrator permissions can now be used securely.'}
                {status === 'recovered' && 'Your account email has been restored. Reset your password if you did not request the earlier change.'}
              </div>
              <Link to="/portal/login" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3.5 text-xs font-black text-white shadow-lg hover:bg-teal-500">
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
