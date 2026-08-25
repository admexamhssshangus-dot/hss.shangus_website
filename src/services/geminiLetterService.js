import { getToken as getAppCheckToken } from 'firebase/app-check';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseAppCheck } from './firebaseAppCheck';

const STORAGE_KEY_GEMINI_KEYS = 'hss_gemini_api_keys';
const STORAGE_KEY_GEMINI_MODEL = 'hss_gemini_preferred_model';
const ENDPOINT = '/.netlify/functions/ai-generate';

export const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)', tier: 'Fast' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'Advanced' },
];

export function getStoredGeminiKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GEMINI_KEYS) || localStorage.getItem('gemini_api_key');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {}
    return [raw.trim()].filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function saveGeminiKeys(keys) {
  try {
    const list = Array.isArray(keys) ? keys : [keys];
    const cleanList = list.filter(Boolean);
    if (cleanList.length > 0) {
      localStorage.setItem(STORAGE_KEY_GEMINI_KEYS, JSON.stringify(cleanList));
      localStorage.setItem('gemini_api_key', cleanList[0]);
    }
  } catch (_) {}
}

export async function fetchCloudGeminiKeys() {
  try {
    const snap = await getDoc(doc(db, 'systemSettings', 'geminiConfig'));
    if (snap.exists()) {
      const data = snap.data();
      const keys = data.apiKeys || (data.apiKey ? [data.apiKey] : []);
      if (keys.length > 0) {
        saveGeminiKeys(keys);
        return keys;
      }
    }
  } catch (_) {}
  return getStoredGeminiKeys();
}

export async function saveCloudGeminiKeys(keys) {
  const list = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);
  saveGeminiKeys(list);
  try {
    await setDoc(doc(db, 'systemSettings', 'geminiConfig'), {
      apiKeys: list,
      apiKey: list[0] || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (_) {}
}

export function getPreferredGeminiModel() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL);
    if (AVAILABLE_GEMINI_MODELS.some((model) => model.id === saved)) return saved;
  } catch (_) {}
  return 'gemini-2.5-flash';
}

export function savePreferredGeminiModel(modelId) {
  if (!AVAILABLE_GEMINI_MODELS.some((model) => model.id === modelId)) return;
  try {
    localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, modelId);
  } catch (_) {}
}

/**
 * Direct Client-Side Gemini Call Fallback (Used when serverless function is unreachable or 404 on localhost)
 */
async function callDirectGeminiClient({ prompt, inlineData, inlineDatas, model, maxOutputTokens = 8192 }) {
  let keys = getStoredGeminiKeys();
  if (!keys.length) {
    keys = await fetchCloudGeminiKeys();
  }

  // Fallback to React env variable if configured
  if (!keys.length && process.env.REACT_APP_GEMINI_API_KEY) {
    keys = [process.env.REACT_APP_GEMINI_API_KEY];
  }

  if (!keys.length) {
    const entered = window.prompt(
      'Gemini AI Key is required for image/gazette analysis.\nPlease enter your Google Gemini API Key:'
    );
    if (entered && entered.trim()) {
      keys = [entered.trim()];
      saveGeminiKeys(keys);
      saveCloudGeminiKeys(keys).catch(() => {});
    } else {
      throw new Error('Gemini API key is required. Please provide an API key to continue.');
    }
  }

  const apiKey = keys[0];
  const modelName = model || getPreferredGeminiModel() || 'gemini-2.5-flash';

  const parts = [{ text: prompt }];

  // Add multiple or single images/PDFs (up to 5 items)
  const items = (inlineDatas && Array.isArray(inlineDatas) ? inlineDatas : (inlineData ? [inlineData] : []));
  items.slice(0, 5).forEach((item) => {
    if (item && item.data) {
      const mime = item.mimeType === 'image/jpg' ? 'image/jpeg' : (item.mimeType || 'image/jpeg');
      const base64Clean = String(item.data).replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inline_data: {
          mime_type: mime,
          data: base64Clean
        }
      });
    }
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens,
        temperature: 0.1
      }
    })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errMsg = errBody?.error?.message || `Gemini API returned HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  const resData = await res.json();
  const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) {
    throw new Error('Gemini AI returned an empty response.');
  }

  return { text, model: modelName };
}

async function requestAi(payload, signal) {
  try {
    const user = auth.currentUser;
    const headers = {
      'Content-Type': 'application/json',
    };

    if (user) {
      headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }

    const appCheck = getFirebaseAppCheck();
    if (appCheck) {
      const appCheckResult = await getAppCheckToken(appCheck, false).catch(() => null);
      if (appCheckResult?.token) headers['X-Firebase-AppCheck'] = appCheckResult.token;
    }

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      cache: 'no-store',
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal,
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('Backend AI function unreachable, attempting direct client fallback...', err);
  }

  // Seamless fallback for structured extraction
  if (payload.task === 'structured') {
    return callDirectGeminiClient({
      prompt: payload.prompt,
      inlineData: payload.inlineData,
      inlineDatas: payload.inlineDatas,
      model: payload.model
    });
  }

  throw new Error('The AI service is temporarily unavailable. Please verify your connection.');
}

export async function generateLetterWithGemini({
  prompt = '',
  currentContent = '',
  mode = 'draft',
  tone = 'Formal Government',
  model = null,
}) {
  return requestAi({ task: 'letter', prompt, currentContent, mode, tone, model: model || getPreferredGeminiModel() });
}

export async function generateCertificateWithGemini({
  prompt = '',
  currentContent = '',
  certificateTitle = 'BONAFIDE CERTIFICATE',
  mode = 'draft',
  tone = 'Formal School',
  model = null,
}) {
  return requestAi({
    task: 'certificate', prompt, currentContent, certificateTitle, mode, tone,
    model: model || getPreferredGeminiModel(),
  });
}

export async function generateStructuredWithGemini({
  prompt,
  inlineData = null,
  inlineDatas = null,
  model = null,
  signal,
}) {
  return requestAi({
    task: 'structured',
    prompt,
    inlineData,
    inlineDatas,
    model: model || getPreferredGeminiModel(),
  }, signal);
}

