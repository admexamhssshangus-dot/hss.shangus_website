import { getToken as getAppCheckToken } from 'firebase/app-check';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseAppCheck } from './firebaseAppCheck';
import { isSuperAdminUser } from './sessionManager';

export function checkIsSuperAdmin(user = null) {
  return isSuperAdminUser(user);
}

const STORAGE_KEY_GEMINI_KEYS = 'hss_gemini_api_keys';
const STORAGE_KEY_GEMINI_MODEL = 'hss_gemini_preferred_model';
const STORAGE_KEY_CUSTOM_MODELS = 'hss_custom_gemini_models';
const STORAGE_KEY_DELETED_MODELS = 'hss_deleted_gemini_models';
const ENDPOINT = '/.netlify/functions/ai-generate';

export const DEFAULT_GEMINI_MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Recommended — Latest & Best Flash)', tier: 'Latest/Best Flash', freeTier: true },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Previous Generation)', tier: 'Fast & Reliable', freeTier: true },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (General Flash)', tier: 'General Purpose', freeTier: true },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (High-Volume / Fast / Cheap)', tier: 'High-Volume Fast', freeTier: true },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite (Fast Automation & Extraction)', tier: 'Automation', freeTier: true },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview (Smartest Fast Reasoning)', tier: 'Smart Fast', freeTier: true },
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

export function getDeletedGeminiModels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_MODELS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

export function getAvailableGeminiModels() {
  const custom = getCustomGeminiModels();
  const deleted = new Set(getDeletedGeminiModels());
  const allMap = new Map();

  DEFAULT_GEMINI_MODELS.forEach(m => {
    if (!deleted.has(m.id)) allMap.set(m.id, m);
  });

  custom.forEach(m => {
    if (!deleted.has(m.id)) allMap.set(m.id, { ...m, isCustom: true });
  });

  const list = Array.from(allMap.values());
  return list.length > 0 ? list : DEFAULT_GEMINI_MODELS;
}

// Keep AVAILABLE_GEMINI_MODELS export in sync
export const AVAILABLE_GEMINI_MODELS = getAvailableGeminiModels();

export async function saveCustomGeminiModel(newModel) {
  if (!newModel || !newModel.id) return getAvailableGeminiModels();
  const cleanId = String(newModel.id).trim();
  const cleanName = String(newModel.name || cleanId).trim();
  const cleanTier = String(newModel.tier || 'Custom').trim();
  const isFree = newModel.freeTier !== undefined ? Boolean(newModel.freeTier) : true;

  // If was previously deleted, un-delete it
  const deleted = getDeletedGeminiModels().filter(id => id !== cleanId);
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_MODELS, JSON.stringify(deleted));
  } catch (_) {}

  const currentCustom = getCustomGeminiModels().filter(m => m.id !== cleanId);
  const updatedCustom = [...currentCustom, { id: cleanId, name: cleanName, tier: cleanTier, freeTier: isFree, isCustom: true }];
  
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(updatedCustom));
  } catch (_) {}

  // Sync to Cloud Firestore
  try {
    await setDoc(doc(db, 'systemSettings', 'geminiConfig'), {
      customModels: updatedCustom,
      deletedModels: deleted,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not sync custom model to Firestore:', err);
  }

  savePreferredGeminiModel(cleanId);
  return getAvailableGeminiModels();
}

export async function deleteGeminiModel(modelId) {
  if (!modelId) return getAvailableGeminiModels();
  const cleanId = String(modelId).trim();

  // 1. Remove from custom models if present
  const updatedCustom = getCustomGeminiModels().filter(m => m.id !== cleanId);
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(updatedCustom));
  } catch (_) {}

  // 2. Add to deleted models list so it won't show in dropdowns
  const deletedSet = new Set(getDeletedGeminiModels());
  deletedSet.add(cleanId);
  const updatedDeleted = Array.from(deletedSet);
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_MODELS, JSON.stringify(updatedDeleted));
  } catch (_) {}

  try {
    await setDoc(doc(db, 'systemSettings', 'geminiConfig'), {
      customModels: updatedCustom,
      deletedModels: updatedDeleted,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not sync deleted model to Firestore:', err);
  }

  if (getPreferredGeminiModel() === cleanId) {
    const available = getAvailableGeminiModels();
    const fallback = available[0]?.id || 'gemini-3.7-flash';
    savePreferredGeminiModel(fallback);
  }
  return getAvailableGeminiModels();
}

export async function restoreDefaultGeminiModels() {
  try {
    localStorage.removeItem(STORAGE_KEY_DELETED_MODELS);
  } catch (_) {}

  try {
    await setDoc(doc(db, 'systemSettings', 'geminiConfig'), {
      deletedModels: [],
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {}

  savePreferredGeminiModel('gemini-3.7-flash');
  return getAvailableGeminiModels();
}

export const removeCustomGeminiModel = deleteGeminiModel;

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
    // If the saved model is an old deprecated 2.5 or 1.5 model, upgrade it immediately to gemini-3.7-flash
    if (saved && (saved.includes('2.5') || saved.includes('1.5') || saved.includes('1.0') || saved === 'gemini-pro')) {
      savePreferredGeminiModel('gemini-3.7-flash');
      return 'gemini-3.7-flash';
    }
    const available = getAvailableGeminiModels();
    if (saved && available.some((m) => m.id === saved)) return saved;
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
 * Supports multi-key failover pool across all connected keys in Firestore & LocalStorage,
 * as well as intelligent multi-model failover for deprecated/sunset models.
 */
export async function callDirectGeminiClient({
  prompt,
  inlineData = null,
  inlineDatas = null,
  maxOutputTokens = 8192,
  model = null,
  signal = null,
  onLog = null
}) {
  let keys = getStoredGeminiKeys();
  if (!keys.length) {
    keys = await fetchCloudGeminiKeys();
  }
  if (!keys.length && process.env.REACT_APP_GEMINI_API_KEY) {
    keys = [process.env.REACT_APP_GEMINI_API_KEY];
  }
  if (!keys || keys.length === 0) {
    throw new Error('No Gemini API keys found. Please configure API keys in Settings.');
  }

  const requestedModel = model || getPreferredGeminiModel() || 'gemini-3.7-flash';
  
  // Build fallback candidate models list
  const candidateModels = Array.from(new Set([
    requestedModel,
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview'
  ])).filter(m => m && !m.includes('2.5') && !m.includes('1.5') && !m.includes('1.0') && m !== 'gemini-pro');

  const parts = [{ text: prompt }];

  // Add multiple or single images/PDFs (up to 5 items)
  const items = (inlineDatas && Array.isArray(inlineDatas) ? inlineDatas : (inlineData ? [inlineData] : []));
  let totalBytes = 0;
  items.slice(0, 5).forEach((item, idx) => {
    if (item && item.data) {
      const mime = item.mimeType === 'image/jpg' ? 'image/jpeg' : (item.mimeType || 'image/jpeg');
      const base64Clean = String(item.data).replace(/^data:[^;]+;base64,/, '');
      totalBytes += base64Clean.length;
      // Google Generative Language v1beta REST API expects camelCase `inlineData` and `mimeType`
      parts.push({
        inlineData: {
          mimeType: mime,
          data: base64Clean
        }
      });
    }
  });

  onLog?.({
    type: 'payload',
    message: `📦 Encoded ${items.length} media item(s) (~${Math.round(totalBytes * 0.75 / 1024)} KB payload) into Gemini multimodal format.`
  });

  let lastError = null;

  // Try candidate models in sequence
  for (const currentModel of candidateModels) {
    onLog?.({
      type: 'model',
      message: `🤖 Target Model: "${currentModel}"...`
    });

    // Try each key in the pool with automatic failover
    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      const maskedKey = apiKey.length > 10 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '••••';
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        try { timeoutController.abort(); } catch (_) {}
      }, 15000); // Strict 15s per-key timeout for fast failover

      // Combine user cancellation signal with 15s per-key timeout signal
      let fetchSignal = timeoutController.signal;
      if (signal) {
        if (typeof AbortSignal.any === 'function') {
          fetchSignal = AbortSignal.any([signal, timeoutController.signal]);
        } else {
          const combo = new AbortController();
          const onAbort = () => { try { combo.abort(); } catch (_) {} };
          signal.addEventListener('abort', onAbort, { once: true });
          timeoutController.signal.addEventListener('abort', onAbort, { once: true });
          fetchSignal = combo.signal;
        }
      }

      onLog?.({
        type: 'request',
        message: `🔑 Dispatched to Key #${i + 1}/${keys.length} (${maskedKey}) on model [${currentModel}]...`
      });

      try {
        const startTime = Date.now();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              maxOutputTokens,
              temperature: 0.1
            }
          }),
          signal: fetchSignal
        });

        clearTimeout(timeoutId);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const errMsg = errBody?.error?.message || `Gemini API returned HTTP ${res.status}`;
          const isAuthTypeErr = errMsg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') || errMsg.includes('UNAUTHENTICATED');
          
          onLog?.({
            type: 'warn',
            message: `⚠️ Key #${i + 1} (${maskedKey}) HTTP ${res.status} (${duration}s): ${isAuthTypeErr ? 'Auth/Project Permission Error. Ensure "Generative Language API" is enabled in Cloud Console.' : errMsg}`
          });

          // If model is deprecated or unavailable, break key loop and try next model
          if (res.status === 404 || errMsg.toLowerCase().includes('no longer available') || errMsg.toLowerCase().includes('not found')) {
            console.warn(`Model ${currentModel} unavailable/deprecated, failing over to next model:`, errMsg);
            lastError = new Error(errMsg);
            break;
          }

          throw new Error(errMsg);
        }

        onLog?.({
          type: 'success',
          message: `✅ Received HTTP 200 OK from Gemini API in ${duration}s! Reading candidate tokens...`
        });

        const resData = await res.json();
        const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!text) {
          throw new Error('Gemini AI returned an empty response.');
        }

        onLog?.({
          type: 'done',
          message: `🎉 Successfully parsed ${text.length} characters of structured AI extraction response!`
        });

        // Remember working model for next time
        if (currentModel !== requestedModel) {
          savePreferredGeminiModel(currentModel);
        }

        return { text, model: currentModel };
      } catch (err) {
        clearTimeout(timeoutId);
        if (signal?.aborted) {
          onLog?.({ type: 'abort', message: '🛑 Analysis cancelled by user.' });
          throw new Error('AI Analysis cancelled by user.');
        }
        if (timeoutController.signal.aborted) {
          onLog?.({
            type: 'warn',
            message: `⏱️ Key #${i + 1} timed out after 15s. Auto-failing over to next key...`
          });
          lastError = new Error(`Key #${i + 1} timed out after 15s`);
          continue;
        }
        onLog?.({
          type: 'warn',
          message: `⚠️ Key #${i + 1} (${maskedKey}) failed: ${err.message || 'Network/Auth Error'}. Failing over...`
        });
        console.warn(`Key #${i + 1} failed for model ${currentModel}:`, err.message);
        lastError = err;
      }
    }
  }

  throw lastError || new Error('All configured Gemini API keys and models failed.');
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
      model: payload.model,
      signal
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
  signal = null,
  onLog = null
}) {
  // If client has stored keys or on localhost, call direct client immediately for ultra-fast processing
  const storedKeys = getStoredGeminiKeys();
  if (storedKeys.length > 0 || window.location.hostname === 'localhost') {
    return callDirectGeminiClient({
      prompt,
      inlineData,
      inlineDatas,
      model: model || getPreferredGeminiModel(),
      signal,
      onLog
    });
  }

  return requestAi({
    task: 'structured',
    prompt,
    inlineData,
    inlineDatas,
    model: model || getPreferredGeminiModel(),
  }, signal);
}

