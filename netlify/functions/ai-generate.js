'use strict';

const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getAppCheck } = require('firebase-admin/app-check');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

function parseServiceAccount(raw) {
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  let value = String(raw).trim();
  if (!value.startsWith('{')) value = Buffer.from(value, 'base64').toString('utf8').trim();
  const serviceAccount = JSON.parse(value);
  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n').replace(/\\r/g, '');
  }
  return serviceAccount;
}

function adminApp() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
}

function allowedOrigin(event) {
  const origin = String(event.headers.origin || '').replace(/\/$/, '');
  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',').map((entry) => entry.trim().replace(/\/$/, '')).filter(Boolean);
  const defaults = [process.env.URL, process.env.DEPLOY_PRIME_URL, 'https://hssshangus.netlify.app']
    .filter(Boolean).map((entry) => String(entry).replace(/\/$/, ''));
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  return origin && [...configured, ...defaults].includes(origin) ? origin : '';
}

function response(statusCode, body, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return { statusCode, headers, body: JSON.stringify(body) };
}

async function authenticate(event) {
  adminApp();
  const authorization = String(event.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  const token = await getAuth(adminApp()).verifyIdToken(authorization.slice(7), true);
  const role = String(token.role || '').toLowerCase().replace(/\s+/g, '');
  const isClaimAdmin = token.admin === true || ['admin', 'superadmin'].includes(role) ||
    String(token.email || '').toLowerCase() === 'adm.exam.hss.shangus@gmail.com';
  if (!isClaimAdmin) throw Object.assign(new Error('Administrator access is required.'), { status: 403 });

  if (process.env.REQUIRE_APP_CHECK !== 'false') {
    const appCheckToken = String(event.headers['x-firebase-appcheck'] || '');
    if (!appCheckToken) throw Object.assign(new Error('App verification is required.'), { status: 401 });
    await getAppCheck(adminApp()).verifyToken(appCheckToken);
  }
  return token;
}

async function consumeRateLimit(uid) {
  const db = getFirestore(adminApp());
  const bucket = Math.floor(Date.now() / 60000);
  const id = crypto.createHash('sha256').update(`ai:${uid}:${bucket}`).digest('hex');
  const ref = db.collection('securityRateLimits').doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = snapshot.exists ? Number(snapshot.data().count || 0) + 1 : 1;
    transaction.set(ref, { count, expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });
    return count <= Math.min(30, Math.max(1, Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 8)));
  });
}

function clean(value, limit) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
}

function buildLetterPrompt(body) {
  const task = body.task === 'certificate' ? 'student certificate' : 'official institutional letter';
  const current = clean(body.currentContent, 30000);
  const prompt = clean(body.prompt, 10000);
  const title = clean(body.certificateTitle, 160);
  return {
    system: `You draft ${task}s for Government Higher Secondary School Shangus, Anantnag, Kashmir. Return only clean body HTML. Do not return a letterhead, scripts, styles, forms, embeds, event handlers, markdown fences or commentary. Use only paragraphs, headings, strong/em/u, lists and simple tables. Preserve template placeholders in braces.`,
    user: `Mode: ${clean(body.mode, 24) || 'draft'}\nTone: ${clean(body.tone, 80) || 'Formal'}\nTitle: ${title}\nInstruction: ${prompt}\nExisting content:\n${current}`,
  };
}

function sanitizeGeneratedHtml(value) {
  return sanitizeHtml(String(value || '').replace(/^```html?\s*/i, '').replace(/```\s*$/i, '').trim(), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'span'],
    allowedAttributes: {
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: [],
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
  }).slice(0, 100000);
}

function getKeys() {
  return String(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
    .split(/[\n,]+/).map((key) => key.trim()).filter(Boolean).slice(0, 5);
}

function chooseModel(requested) {
  const fallback = clean(process.env.GEMINI_MODEL, 80) || 'gemini-2.5-flash';
  const allowed = new Set(String(process.env.GEMINI_ALLOWED_MODELS || fallback)
    .split(',').map((model) => model.trim()).filter((model) => /^gemini-[a-z0-9.-]+$/i.test(model)));
  const candidate = clean(requested, 80);
  return allowed.has(candidate) ? candidate : fallback;
}

async function callGemini({ keys, model, parts, systemInstruction, maxOutputTokens }) {
  let lastError = new Error('The AI service is unavailable.');
  for (const key of keys) {
    try {
      const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.2, topP: 0.95, maxOutputTokens },
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!result.ok) {
        const details = await result.json().catch(() => ({}));
        lastError = new Error(details.error?.message || `Gemini request failed (${result.status}).`);
        continue;
      }
      const data = await result.json();
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
      if (text.trim()) return text;
      lastError = new Error('The AI service returned an empty response.');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

exports.handler = async function handler(event) {
  const origin = allowedOrigin(event);
  if (!origin) return response(403, { error: 'Request origin is not allowed.' });
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Firebase-AppCheck', Vary: 'Origin' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed.' }, origin);
  if (Buffer.byteLength(event.body || '', 'utf8') > 1600000) return response(413, { error: 'Request is too large.' }, origin);

  try {
    const token = await authenticate(event);
    if (!(await consumeRateLimit(token.uid))) return response(429, { error: 'Too many AI requests. Please wait a minute.' }, origin);
    const body = JSON.parse(event.body || '{}');
    const keys = getKeys();
    if (!keys.length) throw Object.assign(new Error('The server AI key is not configured.'), { status: 503 });
    const model = chooseModel(body.model);

    if (body.task === 'structured') {
      const prompt = clean(body.prompt, 30000);
      if (!prompt) throw Object.assign(new Error('An extraction prompt is required.'), { status: 400 });
      const parts = [{ text: prompt }];
      if (body.inlineData) {
        const mimeType = clean(body.inlineData.mimeType, 80);
        const data = String(body.inlineData.data || '');
        if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || Buffer.byteLength(data, 'base64') > 1100000) {
          throw Object.assign(new Error('The uploaded AI document is invalid or too large.'), { status: 400 });
        }
        parts.push({ inline_data: { mime_type: mimeType, data } });
      }
      const text = await callGemini({ keys, model, parts, maxOutputTokens: 8192 });
      return response(200, { text, model }, origin);
    }

    if (!['letter', 'certificate'].includes(body.task)) throw Object.assign(new Error('Invalid AI task.'), { status: 400 });
    const prompts = buildLetterPrompt(body);
    const raw = await callGemini({ keys, model, parts: [{ text: prompts.user }], systemInstruction: prompts.system, maxOutputTokens: 2500 });
    const html = sanitizeGeneratedHtml(raw);
    if (!html) throw new Error('The AI service returned no safe content.');
    return response(200, { html, model }, origin);
  } catch (error) {
    console.error('AI generation error:', error.message);
    const status = error.status || (error.code?.startsWith('auth/') ? 401 : 500);
    return response(status, { error: status >= 500 ? 'The AI service is temporarily unavailable.' : error.message }, origin);
  }
};
