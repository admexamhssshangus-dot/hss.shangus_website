import { getToken as getAppCheckToken } from 'firebase/app-check';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { getFirebaseAppCheck } from './firebaseAppCheck';
import { isSuperAdminUser } from './sessionManager';

const STORAGE_KEY_GEMINI_MODEL = 'hss_gemini_preferred_model';
const STORAGE_KEY_CUSTOM_MODELS = 'hss_custom_gemini_models';
const STORAGE_KEY_DELETED_MODELS = 'hss_deleted_gemini_models';
const LEGACY_SECRET_STORAGE_KEYS = [
  'hss_gemini_api_keys',
  'gemini_api_key',
  'hss_gemini_keys',
  'gemini_api_keys',
  'GEMINI_API_KEY',
  'gemini_key',
];
const ENDPOINT = '/.netlify/functions/ai-generate';
const GEMINI_CONFIG_PATH = ['systemSettings', 'geminiConfig'];

export function checkIsSuperAdmin(user = null) {
  return isSuperAdminUser(user);
}

export const DEFAULT_GEMINI_MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Recommended)', tier: 'Latest flash', freeTier: true },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', tier: 'Fast and reliable', freeTier: true },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', tier: 'General purpose', freeTier: true },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', tier: 'High volume', freeTier: true },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', tier: 'Automation', freeTier: true },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', tier: 'Preview', freeTier: true },
];

function readJsonPreference(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(value) ? value : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJsonPreference(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // Local preference caching is optional; Firestore remains authoritative.
  }
}

function cleanModel(model) {
  const id = String(model?.id || '').trim();
  if (!/^gemini-[a-z0-9.-]+$/i.test(id)) return null;
  return {
    id,
    name: String(model?.name || id).trim().slice(0, 100),
    tier: String(model?.tier || 'Custom').trim().slice(0, 60),
    freeTier: model?.freeTier !== false,
    isCustom: true,
  };
}

export function getCustomGeminiModels() {
  return readJsonPreference(STORAGE_KEY_CUSTOM_MODELS)
    .map(cleanModel)
    .filter(Boolean);
}

export function getDeletedGeminiModels() {
  return readJsonPreference(STORAGE_KEY_DELETED_MODELS)
    .map((id) => String(id || '').trim())
    .filter((id) => /^gemini-[a-z0-9.-]+$/i.test(id));
}

export function getAvailableGeminiModels() {
  const deleted = new Set(getDeletedGeminiModels());
  const models = new Map();
  DEFAULT_GEMINI_MODELS.forEach((model) => {
    if (!deleted.has(model.id)) models.set(model.id, model);
  });
  getCustomGeminiModels().forEach((model) => {
    if (!deleted.has(model.id)) models.set(model.id, model);
  });
  const available = Array.from(models.values());
  return available.length ? available : DEFAULT_GEMINI_MODELS;
}

export const AVAILABLE_GEMINI_MODELS = getAvailableGeminiModels();

async function persistModelConfiguration(customModels, deletedModels) {
  await setDoc(doc(db, ...GEMINI_CONFIG_PATH), {
    customModels,
    deletedModels,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.currentUser?.uid || null,
  }, { merge: true });
}

export async function saveCustomGeminiModel(newModel) {
  const model = cleanModel(newModel);
  if (!model) throw new Error('Enter a valid Gemini model ID.');

  const customModels = getCustomGeminiModels().filter((item) => item.id !== model.id);
  customModels.push(model);
  const deletedModels = getDeletedGeminiModels().filter((id) => id !== model.id);
  await persistModelConfiguration(customModels, deletedModels);
  writeJsonPreference(STORAGE_KEY_CUSTOM_MODELS, customModels);
  writeJsonPreference(STORAGE_KEY_DELETED_MODELS, deletedModels);
  savePreferredGeminiModel(model.id);
  return getAvailableGeminiModels();
}

export async function deleteGeminiModel(modelId) {
  const id = String(modelId || '').trim();
  if (!/^gemini-[a-z0-9.-]+$/i.test(id)) return getAvailableGeminiModels();

  const customModels = getCustomGeminiModels().filter((item) => item.id !== id);
  const deletedModels = Array.from(new Set([...getDeletedGeminiModels(), id]));
  await persistModelConfiguration(customModels, deletedModels);
  writeJsonPreference(STORAGE_KEY_CUSTOM_MODELS, customModels);
  writeJsonPreference(STORAGE_KEY_DELETED_MODELS, deletedModels);

  if (getPreferredGeminiModel() === id) savePreferredGeminiModel(DEFAULT_GEMINI_MODELS[0].id);
  return getAvailableGeminiModels();
}

export async function restoreDefaultGeminiModels() {
  const customModels = getCustomGeminiModels();
  await persistModelConfiguration(customModels, []);
  writeJsonPreference(STORAGE_KEY_DELETED_MODELS, []);
  savePreferredGeminiModel(DEFAULT_GEMINI_MODELS[0].id);
  return getAvailableGeminiModels();
}

export const removeCustomGeminiModel = deleteGeminiModel;

function removeLegacyBrowserSecrets() {
  LEGACY_SECRET_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (_) {
      // Storage may be disabled by the browser.
    }
  });
}

// Compatibility exports: credentials are intentionally never returned to browser code.
export function getStoredGeminiKeys() {
  removeLegacyBrowserSecrets();
  return [];
}

export function saveGeminiKeys() {
  removeLegacyBrowserSecrets();
  throw new Error('Gemini credentials are server-managed. Configure GEMINI_API_KEYS in the protected Netlify environment.');
}

export async function fetchCloudGeminiKeys() {
  removeLegacyBrowserSecrets();
  try {
    const snapshot = await getDoc(doc(db, ...GEMINI_CONFIG_PATH));
    if (snapshot.exists()) {
      const data = snapshot.data() || {};
      const customModels = Array.isArray(data.customModels)
        ? data.customModels.map(cleanModel).filter(Boolean)
        : [];
      const deletedModels = Array.isArray(data.deletedModels)
        ? data.deletedModels.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
      writeJsonPreference(STORAGE_KEY_CUSTOM_MODELS, customModels);
      writeJsonPreference(STORAGE_KEY_DELETED_MODELS, deletedModels);
    }
  } catch (error) {
    console.warn('Could not refresh the non-secret AI model configuration:', error);
  }
  return [];
}

export async function saveCloudGeminiKeys() {
  removeLegacyBrowserSecrets();
  throw new Error('API keys cannot be saved from the browser. Configure GEMINI_API_KEYS in Netlify environment variables.');
}

export function getPreferredGeminiModel() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL);
    if (saved && getAvailableGeminiModels().some((model) => model.id === saved)) return saved;
  } catch (_) {
    // Use the safe default below.
  }
  return DEFAULT_GEMINI_MODELS[0].id;
}

export function savePreferredGeminiModel(modelId) {
  const id = String(modelId || '').trim();
  if (!/^gemini-[a-z0-9.-]+$/i.test(id)) return;
  try {
    localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, id);
  } catch (_) {
    // Model preference is optional.
  }
}

async function requestAi(payload, signal, onLog) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again before using the AI service.');

  onLog?.({ type: 'request', message: 'Sending the request through the authenticated server AI gateway…' });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await user.getIdToken()}`,
  };

  const appCheck = getFirebaseAppCheck();
  if (appCheck) {
    const appCheckResult = await getAppCheckToken(appCheck, false).catch(() => null);
    if (appCheckResult?.token) headers['X-Firebase-AppCheck'] = appCheckResult.token;
  }

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      cache: 'no-store',
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw new Error('AI analysis was cancelled.');
    throw new Error('The secure AI service is unavailable. Run through Netlify Dev locally or verify the deployed function.');
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `The secure AI service returned HTTP ${response.status}.`);

  onLog?.({ type: 'success', message: `Secure AI processing completed${result.model ? ` with ${result.model}` : ''}.` });
  return result;
}

// Kept for existing callers; despite the legacy name, it now uses only the server gateway.
export async function callDirectGeminiClient({
  prompt,
  inlineData = null,
  inlineDatas = null,
  maxOutputTokens = 8192,
  model = null,
  signal = null,
  onLog = null,
}) {
  return requestAi({
    task: 'structured',
    prompt,
    inlineData,
    inlineDatas,
    maxOutputTokens,
    model: model || getPreferredGeminiModel(),
  }, signal, onLog);
}

export async function generateLetterWithGemini({ prompt = '', currentContent = '', mode = 'draft', tone = 'Formal Government', model = null }) {
  return requestAi({ task: 'letter', prompt, currentContent, mode, tone, model: model || getPreferredGeminiModel() });
}

export async function generateCertificateWithGemini({ prompt = '', currentContent = '', certificateTitle = 'BONAFIDE CERTIFICATE', mode = 'draft', tone = 'Formal School', model = null }) {
  return requestAi({ task: 'certificate', prompt, currentContent, certificateTitle, mode, tone, model: model || getPreferredGeminiModel() });
}

export async function generateStructuredWithGemini({ prompt, inlineData = null, inlineDatas = null, model = null, signal = null, onLog = null }) {
  return requestAi({ task: 'structured', prompt, inlineData, inlineDatas, model: model || getPreferredGeminiModel() }, signal, onLog);
}
