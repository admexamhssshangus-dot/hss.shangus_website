export function backendEndpoint(name) {
  const configured = String(process.env.REACT_APP_BACKEND_ORIGIN || '').replace(/\/$/, '');
  if (configured) {
    const origin = new URL(configured);
    if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Backend origin must use HTTPS.');
    return `${origin.origin}/.netlify/functions/${name}`;
  }
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const base = /\.(web\.app|firebaseapp\.com)$/.test(hostname) ? 'https://hssshangus.netlify.app' : '';
  return `${base}/.netlify/functions/${name}`;
}
export async function publicLookup(name, payload, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 8000);
  try {
    const response = await fetch(backendEndpoint(name), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), cache: 'no-store', signal: controller.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw Object.assign(new Error(result?.error || 'The lookup service is temporarily unavailable.'), { status: response.status });
    return result;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
