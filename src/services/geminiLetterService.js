import { getToken as getAppCheckToken } from 'firebase/app-check';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseAppCheck } from './firebaseAppCheck';

const STORAGE_KEY_GEMINI_KEYS = 'hss_gemini_api_keys';
const STORAGE_KEY_GEMINI_MODEL = 'hss_gemini_preferred_model';
const STORAGE_KEY_CUSTOM_MODELS = 'hss_custom_gemini_models';
const ENDPOINT = '/.netlify/functions/ai-generate';

export const DEFAULT_GEMINI_MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Recommended — Latest & Best Flash)', tier: 'Latest/Best Flash', freeTier: true },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Previous Generation)', tier: 'Fast & Reliable', freeTier: true },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (General Flash)', tier: 'General Purpose', freeTier: true },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (High-Volume / Fast / Cheap)', tier: 'High-Volume Fast', freeTier: true },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite (Fast Automation & Extraction)', tier: 'Automation', freeTier: true },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview (Smartest Fast Reasoning)', tier: 'Smart Fast', freeTier: true },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Legacy Multimodal Workhorse)', tier: 'Stable', freeTier: true },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite (Legacy Cheap / Fast)', tier: 'Ultra-Fast', freeTier: true },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Complex Reasoning)', tier: 'Advanced Pro', freeTier: false },
];

export function getCustomGeminiModels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_MODELS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(m => m && m.id) : [];
  } catch (_) {
    return [];
  }
}

export function getAvailableGeminiModels() {
  const custom = getCustomGeminiModels();
  const allMap = new Map();
  DEFAULT_GEMINI_MODELS.forEach(m => allMap.set(m.id, m));
  custom.forEach(m => allMap.set(m.id, { ...m, isCustom: true }));
  return Array.from(allMap.values());
}

// Keep AVAILABLE_GEMINI_MODELS export in sync
export const AVAILABLE_GEMINI_MODELS = getAvailableGeminiModels();

export async function saveCustomGeminiModel(newModel) {
  if (!newModel || !newModel.id) return getAvailableGeminiModels();
  const cleanId = String(newModel.id).trim();
  const cleanName = String(newModel.name || cleanId).trim();
  const cleanTier = String(newModel.tier || 'Custom').trim();
  const isFree = newModel.freeTier !== undefined ? Boolean(newModel.freeTier) : true;

  const currentCustom = getCustomGeminiModels().filter(m => m.id !== cleanId);
  const updatedCustom = [...currentCustom, { id: cleanId, name: cleanName, tier: cleanTier, freeTier: isFree, isCustom: true }];
  
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(updatedCustom));
  } catch (_) {}

  // Sync to Cloud Firestore
  try {
    await setDoc(doc(db, 'systemSettings', 'geminiConfig'), {
      customModels: updatedCustom,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not sync custom model to Firestore:', err);
  }

  savePreferredGeminiModel(cleanId);
  return getAvailableGeminiModels();
}

export async function removeCustomGeminiModel(modelId) {
  if (!modelId) return getAvailableGeminiModels();
  const updatedCustom = getCustomGeminiModels().filter(m => m.id !== modelId);
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(updatedCustom));
  } catch (_) {}

  try {
    await setDoc(doc(db, 'systemSettings', 'geminiConfig'), {
      customModels: updatedCustom,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not sync removed model to Firestore:', err);
  }

  if (getPreferredGeminiModel() === modelId) {
    savePreferredGeminiModel('gemini-2.5-flash');
  }
  return getAvailableGeminiModels();
}

export function getStoredGeminiKeys() {
  try {
    const keysFound = [];
    const storageKeys = [
      STORAGE_KEY_GEMINI_KEYS,
      'gemini_api_key',
      'hss_gemini_keys',
      'gemini_api_keys',
      'GEMINI_API_KEY',
      'gemini_key'
    ];

    storageKeys.forEach(k => {
      try {
        const val = localStorage.getItem(k);
        if (!val) return;
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
              if (item && typeof item === 'string' && item.trim()) keysFound.push(item.trim());
            });
          } else if (typeof parsed === 'string' && parsed.trim()) {
            keysFound.push(parsed.trim());
          }
        } catch (_) {
          if (typeof val === 'string' && val.trim()) keysFound.push(val.trim());
        }
      } catch (_) {}
    });

    const unique = Array.from(new Set(keysFound));
    return unique;
  } catch (_) {
    return [];
  }
}

export function saveGeminiKeys(keys) {
  try {
    const list = Array.isArray(keys) ? keys : [keys];
    const cleanList = Array.from(new Set(list.map(k => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)));
    if (cleanList.length > 0) {
      localStorage.setItem(STORAGE_KEY_GEMINI_KEYS, JSON.stringify(cleanList));
      localStorage.setItem('gemini_api_key', cleanList[0]);
      localStorage.setItem('hss_gemini_keys', JSON.stringify(cleanList));
      localStorage.setItem('gemini_api_keys', JSON.stringify(cleanList));
    }
  } catch (_) {}
}

export async function fetchCloudGeminiKeys() {
  const discovered = new Set(getStoredGeminiKeys());

  try {
    // 1. Try systemSettings/geminiConfig
    const snap1 = await getDoc(doc(db, 'systemSettings', 'geminiConfig'));
    if (snap1.exists()) {
      const data = snap1.data() || {};
      const keys = data.apiKeys || data.keys || (data.apiKey ? [data.apiKey] : []) || [];
      if (Array.isArray(keys)) keys.forEach(k => k && discovered.add(String(k).trim()));
      else if (typeof keys === 'string' && keys.trim()) discovered.add(keys.trim());

      // Sync custom models if present in cloud
      if (Array.isArray(data.customModels) && data.customModels.length > 0) {
        try {
          const localCustom = getCustomGeminiModels();
          const merged = new Map();
          localCustom.forEach(m => merged.set(m.id, m));
          data.customModels.forEach(m => m && m.id && merged.set(m.id, m));
          localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(Array.from(merged.values())));
        } catch (_) {}
      }
    }
  } catch (_) {}

  try {
    // 2. Try systemSettings/aiConfig
    const snap2 = await getDoc(doc(db, 'systemSettings', 'aiConfig'));
    if (snap2.exists()) {
      const data = snap2.data() || {};
      const keys = data.apiKeys || data.keys || data.aiKeys || (data.apiKey ? [data.apiKey] : []) || [];
      if (Array.isArray(keys)) keys.forEach(k => k && discovered.add(String(k).trim()));
      else if (typeof keys === 'string' && keys.trim()) discovered.add(keys.trim());
    }
  } catch (_) {}

  try {
    // 3. Try systemSettings/globalSettings
    const snap3 = await getDoc(doc(db, 'systemSettings', 'globalSettings'));
    if (snap3.exists()) {
      const data = snap3.data() || {};
      const keys = data.geminiKeys || (data.geminiApiKey ? [data.geminiApiKey] : []) || [];
      if (Array.isArray(keys)) keys.forEach(k => k && discovered.add(String(k).trim()));
    }
  } catch (_) {}

  const finalKeys = Array.from(discovered).filter(Boolean);
  if (finalKeys.length > 0) {
    saveGeminiKeys(finalKeys);
  }
  return finalKeys;
}

export async function saveCloudGeminiKeys(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const cleanList = Array.from(new Set(list.map(k => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)));
  saveGeminiKeys(cleanList);

  const customModels = getCustomGeminiModels();

  const payload = {
    apiKeys: cleanList,
    apiKey: cleanList[0] || '',
    customModels: customModels,
    updatedAt: new Date().toISOString()
  };

  try {
    await Promise.all([
      setDoc(doc(db, 'systemSettings', 'geminiConfig'), payload, { merge: true }),
      setDoc(doc(db, 'systemSettings', 'aiConfig'), payload, { merge: true })
    ]);
  } catch (err) {
    console.warn('Could not write to systemSettings/geminiConfig:', err);
  }
}

export function getPreferredGeminiModel() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL);
    const available = getAvailableGeminiModels();
    if (saved && (available.some((model) => model.id === saved) || saved.startsWith('gemini-'))) return saved;
  } catch (_) {}
  return 'gemini-3.7-flash';
}

export function savePreferredGeminiModel(modelId) {
  if (!modelId) return;
  try {
    localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, modelId);
  } catch (_) {}
}

/**
 * Direct Client-Side Gemini Call Fallback (Used when serverless function is unreachable or 404 on localhost)
 * Supports multi-key failover pool across all connected keys in Firestore & LocalStorage.
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
      '🔑 Gemini AI API Key Required\n\nPlease enter your Google Gemini API Key. It will be saved permanently to Cloud Firestore & LocalStorage for all modules (Certificates, Bulk Import, Admit Cards, Gazette):'
    );
    if (entered && entered.trim()) {
      keys = [entered.trim()];
      saveGeminiKeys(keys);
      saveCloudGeminiKeys(keys).catch(() => {});
    } else {
      throw new Error('Gemini API key is required to perform AI analysis. Please configure your key in settings.');
    }
  }

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

  let lastError = null;

  // Try each key in the pool with automatic failover
  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    try {
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
    } catch (err) {
      console.warn(`Key #${i + 1} failed in direct Gemini client:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All configured Gemini API keys failed.');
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

