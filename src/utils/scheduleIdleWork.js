/**
 * Run non-critical hydration after the browser has painted the active module.
 * Returns a cancellation function suitable for React effect cleanup.
 */
export function scheduleIdleWork(work, timeout = 1200) {
  if (typeof window === 'undefined' || typeof work !== 'function') return () => {};

  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(() => work(), { timeout });
    return () => window.cancelIdleCallback?.(idleId);
  }

  const timerId = window.setTimeout(work, 32);
  return () => window.clearTimeout(timerId);
}

