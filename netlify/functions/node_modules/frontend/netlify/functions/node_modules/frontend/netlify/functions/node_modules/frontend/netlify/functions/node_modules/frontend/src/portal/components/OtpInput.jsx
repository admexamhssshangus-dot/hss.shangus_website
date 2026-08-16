import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';

/**
 * OtpInput — Reusable 6-Digit OTP Input component with timer and resend.
 * 
 * Props:
 * - value: string (6-digit OTP value)
 * - onChange: (otpString) => void
 * - onResend: () => Promise<void>
 * - resendDelay: number (seconds for countdown, default 60)
 * - disabled: boolean
 */
export default function OtpInput({
  value = '',
  onChange,
  onResend,
  resendDelay = 60,
  disabled = false,
}) {
  const [timer, setTimer] = useState(resendDelay);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputsRef = useRef([]);

  // Split 6-digit value into array of single chars
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }
    setCanResend(false);
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index, val) => {
    if (disabled) return;
    const cleanVal = val.replace(/[^0-9]/g, '');
    
    // Handle paste of full 6-digit OTP
    if (cleanVal.length > 1) {
      const pastedOtp = cleanVal.slice(0, 6);
      onChange(pastedOtp);
      const nextFocus = Math.min(pastedOtp.length, 5);
      inputsRef.current[nextFocus]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanVal;
    const newOtp = newDigits.join('');
    onChange(newOtp);

    // Auto-advance to next input
    if (cleanVal && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (disabled) return;
    // Move to previous box on Backspace if current is empty
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleResendClick = async () => {
    if (!canResend || isResending || !onResend) return;
    setIsResending(true);
    try {
      await onResend();
      setTimer(resendDelay);
      setCanResend(false);
    } catch (err) {
      console.error('Failed to resend OTP:', err);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* 6 Digit Input Grid */}
      <div className="flex justify-between items-center gap-1.5 sm:gap-2">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => (inputsRef.current[idx] = el)}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            disabled={disabled}
            className="w-11 h-12 sm:w-12 sm:h-14 text-center font-bold text-lg sm:text-xl rounded-xl border transition-all duration-150 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-input, var(--bg-card))',
              borderColor: digit ? 'var(--teal-accent, #0d9488)' : 'var(--border-ui, #cbd5e1)',
              color: 'var(--text-main, #0f172a)',
            }}
          />
        ))}
      </div>

      {/* Timer & Resend Controls */}
      <div className="flex items-center justify-between text-xs px-1">
        <span style={{ color: 'var(--text-muted, #64748b)' }}>
          {!canResend ? (
            <span>Resend available in <strong className="font-semibold text-teal-600 dark:text-teal-400">{timer}s</strong></span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle size={14} /> Ready to resend
            </span>
          )}
        </span>

        {onResend && (
          <button
            type="button"
            onClick={handleResendClick}
            disabled={!canResend || isResending}
            className="font-bold flex items-center gap-1 transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:underline"
            style={{ color: 'var(--teal-accent, #0d9488)' }}
          >
            {isResending && <RefreshCw size={12} className="animate-spin" />}
            <span>{isResending ? 'Sending...' : 'Resend OTP'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
