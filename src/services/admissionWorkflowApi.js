import { getToken as getAppCheckToken } from 'firebase/app-check';
import { auth } from './firebase';
import { getFirebaseAppCheck } from './firebaseAppCheck';

const ENDPOINT = '/.netlify/functions/admission-workflow';
const SERVICE_COOLDOWN_MS = 30 * 1000;
let serviceUnavailableUntil = 0;
let cachedServiceError = null;

function workflowError(message, status = 0, fieldErrors = {}) {
  const error = new Error(message);
  error.status = status;
  error.fieldErrors = fieldErrors;
  error.isServiceUnavailable = status === 0 || status === 404 || status >= 500;
  return error;
}

async function request(action, payload = {}, { force = false } = {}) {
  if (!force && action === 'draft' && cachedServiceError && Date.now() < serviceUnavailableUntil) {
    throw cachedServiceError;
  }

  const user = auth.currentUser;
  if (!user) throw workflowError('Your session has expired. Please sign in again.', 401);

  const idToken = await user.getIdToken();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
  const appCheck = getFirebaseAppCheck();
  if (appCheck) {
    try {
      const token = await getAppCheckToken(appCheck, false);
      if (token?.token) headers['X-Firebase-AppCheck'] = token.token;
    } catch (error) {
      console.warn('App Check token unavailable:', error);
    }
  }

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      cache: 'no-store',
      credentials: 'same-origin',
      body: JSON.stringify({ action, ...payload }),
    });
  } catch (cause) {
    const error = workflowError('The admission service could not be reached. Check your connection and try again.');
    error.cause = cause;
    cachedServiceError = error;
    serviceUnavailableUntil = Date.now() + SERVICE_COOLDOWN_MS;
    throw error;
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const localMissing = response.status === 404 && window.location.hostname === 'localhost';
    const error = workflowError(
      localMissing
        ? 'The local admission backend is not running. Use Netlify Dev so the authenticated cloud workflow is available locally.'
        : (result.error || 'Admission service is temporarily unavailable.'),
      response.status,
      result.fieldErrors || {},
    );
    if (error.isServiceUnavailable) {
      cachedServiceError = error;
      serviceUnavailableUntil = Date.now() + SERVICE_COOLDOWN_MS;
    }
    throw error;
  }

  cachedServiceError = null;
  serviceUnavailableUntil = 0;
  return result;
}

function prepareFirestorePhoto(formData) {
  const photo = formData?.['Student Photo'] || formData?.photo_id || formData?.photoUrl || '';
  if (!photo) return '';
  const value = String(photo);
  if (/^https:\/\//i.test(value)) return value;
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i);
  const estimatedBytes = match ? Math.floor((match[2].length * 3) / 4) : 0;
  if (!match || estimatedBytes <= 0 || estimatedBytes > 100 * 1024) {
    throw workflowError('The processed photograph is invalid or too large. Please upload it again.', 422, {
      'Student Photo': 'Upload a valid compressed JPEG, PNG, or WebP photograph.',
    });
  }
  return value;
}

function canonicalizePhoto(formData, photo = '') {
  const clean = { ...formData };
  ['Student Photo', 'photo_id', 'photoId', 'photo', 'photoUrl', 'photoPath'].forEach(key => delete clean[key]);
  if (photo) clean.photo_id = photo;
  return clean;
}

export async function loadAdmissionWorkspace() {
  return request('load');
}

export async function saveAdmissionDraft({ formData, applicationId, force = false }) {
  // Sensitive identifiers and images are saved only on final submission. The
  // remaining draft is persisted authoritatively in Firestore by the backend.
  const safeDraft = { ...formData };
  [
    'Aadhar No.',
    "Father's Aadhar No.",
    'Bank Account No.',
    'Student Photo',
    'photo_id',
    'photo',
    'photoUrl',
  ].forEach(key => delete safeDraft[key]);

  return request('draft', { formData: safeDraft, applicationId }, { force });
}

export async function submitAdmission({ formData, applicationId, submissionKey, upgradeMode = false }) {
  const photo = prepareFirestorePhoto(formData);
  const cleanFormData = canonicalizePhoto(formData, photo);
  return request('submit', {
    formData: cleanFormData,
    photo,
    applicationId,
    submissionKey,
    upgradeMode,
  });
}

export async function withdrawAdmission(applicationId) {
  return request('withdraw', { applicationId });
}

const admissionWorkflowApi = {
  loadAdmissionWorkspace,
  saveAdmissionDraft,
  submitAdmission,
  withdrawAdmission,
};

export default admissionWorkflowApi;
