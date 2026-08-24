import { getToken as getAppCheckToken } from 'firebase/app-check';
import { auth } from './firebase';
import { getFirebaseAppCheck } from './firebaseAppCheck';

const STORAGE_KEY_GEMINI_KEYS = 'hss_gemini_api_keys';
const STORAGE_KEY_GEMINI_MODEL = 'hss_gemini_preferred_model';
const ENDPOINT = '/.netlify/functions/ai-generate';

export const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)', tier: 'Fast' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'Advanced' },
];

function removeLegacyClientKeys() {
  try {
    localStorage.removeItem(STORAGE_KEY_GEMINI_KEYS);
  } catch (_) {}
}

// Compatibility exports retained while old settings panels are removed. API
// keys are intentionally never returned to or accepted from browser storage.
export function getStoredGeminiKeys() {
  removeLegacyClientKeys();
  return [];
}

export function saveGeminiKeys() {
  removeLegacyClientKeys();
  return [];
}

export async function fetchCloudGeminiKeys() {
  removeLegacyClientKeys();
  return [];
}

export async function saveCloudGeminiKeys() {
  removeLegacyClientKeys();
  throw new Error('Gemini keys are now configured only as server-side Netlify environment variables.');
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

async function requestAi(payload, signal) {
  const user = auth.currentUser;
  if (!user) throw new Error('Your administrator session has expired. Please sign in again.');

  const headers = {
    Authorization: `Bearer ${await user.getIdToken()}`,
    'Content-Type': 'application/json',
  };
  const appCheck = getFirebaseAppCheck();
  if (appCheck) {
    const appCheckResult = await getAppCheckToken(appCheck, false);
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
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The AI service is temporarily unavailable.');
  return result;
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
  model = null,
  signal,
}) {
  return requestAi({
    task: 'structured',
    prompt,
    inlineData,
    model: model || getPreferredGeminiModel(),
  }, signal);
}
