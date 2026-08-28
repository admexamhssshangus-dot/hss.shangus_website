/**
 * Client-Side Rate Limiter for Authentication Emails (Verification & Password Reset)
 * Protects Firebase/SMTP daily quotas by enforcing:
 * 1. Cooldown timer between consecutive requests (default 60s)
 * 2. Daily request quota per email (default max 4 per day)
 */

function getStorageKeys(action, email) {
  const cleanEmail = String(email || '').trim().toLowerCase().replace(/[^a-z0-9_@.]/g, '_');
  const safeAction = String(action || 'default').trim().toLowerCase();
  return {
    tsKey: `hss_email_ts_${safeAction}_${cleanEmail}`,
    dailyKey: `hss_email_daily_${safeAction}_${cleanEmail}`,
  };
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function checkEmailRateLimit(action, email, options = {}) {
  const cooldownSeconds = options.cooldownSeconds ?? 60;
  const maxDaily = options.maxDaily ?? 4;

  if (!email || typeof window === 'undefined') {
    return { allowed: true, remainingCooldown: 0, remainingDaily: maxDaily, message: null };
  }

  const { tsKey, dailyKey } = getStorageKeys(action, email);
  const now = Date.now();

  // 1. Check Cooldown
  let lastSentTs = 0;
  try {
    const rawTs = localStorage.getItem(tsKey);
    if (rawTs) lastSentTs = parseInt(rawTs, 10) || 0;
  } catch (_) {}

  const elapsedSeconds = Math.floor((now - lastSentTs) / 1000);
  const remainingCooldown = Math.max(0, cooldownSeconds - elapsedSeconds);

  if (remainingCooldown > 0) {
    return {
      allowed: false,
      remainingCooldown,
      remainingDaily: 0,
      message: `Please wait ${remainingCooldown}s before requesting another email.`,
    };
  }

  // 2. Check Daily Limit
  const todayStr = getTodayString();
  let todayCount = 0;
  try {
    const rawDaily = localStorage.getItem(dailyKey);
    if (rawDaily) {
      const parsed = JSON.parse(rawDaily);
      if (parsed && parsed.date === todayStr) {
        todayCount = parsed.count || 0;
      }
    }
  } catch (_) {}

  if (todayCount >= maxDaily) {
    return {
      allowed: false,
      remainingCooldown: 0,
      remainingDaily: 0,
      message: `Daily limit of ${maxDaily} requests reached for this email. Please try again tomorrow or contact school support.`,
    };
  }

  return {
    allowed: true,
    remainingCooldown: 0,
    remainingDaily: Math.max(0, maxDaily - todayCount),
    message: null,
  };
}

export function recordEmailSent(action, email) {
  if (!email || typeof window === 'undefined') return;

  const { tsKey, dailyKey } = getStorageKeys(action, email);
  const now = Date.now();
  const todayStr = getTodayString();

  try {
    localStorage.setItem(tsKey, String(now));

    let todayCount = 0;
    const rawDaily = localStorage.getItem(dailyKey);
    if (rawDaily) {
      const parsed = JSON.parse(rawDaily);
      if (parsed && parsed.date === todayStr) {
        todayCount = parsed.count || 0;
      }
    }

    localStorage.setItem(dailyKey, JSON.stringify({ date: todayStr, count: todayCount + 1 }));
  } catch (_) {}
}

export function getRemainingCooldown(action, email, cooldownSeconds = 60) {
  if (!email || typeof window === 'undefined') return 0;
  const { tsKey } = getStorageKeys(action, email);
  try {
    const rawTs = localStorage.getItem(tsKey);
    if (!rawTs) return 0;
    const lastSentTs = parseInt(rawTs, 10) || 0;
    const elapsedSeconds = Math.floor((Date.now() - lastSentTs) / 1000);
    return Math.max(0, cooldownSeconds - elapsedSeconds);
  } catch (_) {
    return 0;
  }
}
