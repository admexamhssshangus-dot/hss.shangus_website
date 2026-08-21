import { getToken as getAppCheckToken } from 'firebase/app-check';
import { auth } from './firebase';
import { getFirebaseAppCheck } from './firebaseAppCheck';

const PROD_ENDPOINT = 'https://hssshangus.netlify.app/.netlify/functions/admission-workflow';
const ENDPOINT = '/.netlify/functions/admission-workflow';
const SERVICE_COOLDOWN_MS = 60 * 1000;
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
  if (!user) throw new Error('Your session has expired. Please sign in again.');
  const idToken = await user.getIdToken();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
  const appCheck = getFirebaseAppCheck();
  if (appCheck) {
    try {
      const token = await getAppCheckToken(appCheck, false);
      if (token?.token) headers['X-Firebase-AppCheck'] = token.token;
    } catch (error) {
      console.warn('App Check token unavailable:', error);
    }
  }

  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ action, ...payload }),
    });

    // If local dev proxy fails, transparently retry against live upstream endpoint
    if (!response.ok && isLocal && (response.status >= 500 || response.status === 404)) {
      console.warn(`Local proxy returned ${response.status}, retrying direct live backend.`);
      response = await fetch(PROD_ENDPOINT, {
        method: 'POST', headers, cache: 'no-store',
        body: JSON.stringify({ action, ...payload }),
      });
    }
  } catch (cause) {
    if (isLocal) {
      try {
        console.warn('Local endpoint connection failed, retrying direct live backend.');
        response = await fetch(PROD_ENDPOINT, {
          method: 'POST', headers, cache: 'no-store',
          body: JSON.stringify({ action, ...payload }),
        });
      } catch (prodCause) {
        const error = workflowError('The admission service could not be reached. Check your connection and try again.');
        error.cause = prodCause;
        cachedServiceError = error;
        serviceUnavailableUntil = Date.now() + SERVICE_COOLDOWN_MS;
        throw error;
      }
    } else {
      const error = workflowError('The admission service could not be reached. Check your connection and try again.');
      error.cause = cause;
      cachedServiceError = error;
      serviceUnavailableUntil = Date.now() + SERVICE_COOLDOWN_MS;
      throw error;
    }
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = workflowError(
      result.error || 'Admission service is temporarily unavailable.',
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
    throw new Error('The processed photograph is invalid or too large. Please upload it again.');
  }
  return value;
}

function canonicalizePhoto(formData, photo = '') {
  const clean = { ...formData };
  ['Student Photo', 'photo_id', 'photoId', 'photo', 'photoUrl', 'photoPath'].forEach(key => delete clean[key]);
  if (photo) clean.photo_id = photo;
  return clean;
}

function getLocalDraftKey(uid = 'guest') {
  return `hss_student_draft_${uid}`;
}

export async function loadAdmissionWorkspace() {
  const user = auth.currentUser;
  try {
    const remote = await request('load');
    return remote;
  } catch (err) {
    if (err.isServiceUnavailable || err.status === 404) {
      console.warn('Admission remote backend unavailable, checking local draft storage.');
      try {
        const raw = localStorage.getItem(getLocalDraftKey(user?.uid));
        if (raw) {
          const parsed = JSON.parse(raw);
          return { application: parsed, admissionWindow: { isOpen: true }, isLocalFallback: true };
        }
      } catch (e) {
        console.warn('Local draft load error:', e);
      }
      return { application: null, admissionWindow: { isOpen: true }, isLocalFallback: true };
    }
    throw err;
  }
}

export async function saveAdmissionDraft({ formData, applicationId, force = false }) {
  // Drafts intentionally exclude Aadhaar, bank details, and inline images from server autosave.
  const safeDraft = { ...formData };
  ['Aadhar No.', "Father's Aadhar No.", 'Bank Account No.', 'Student Photo', 'photo_id', 'photo', 'photoUrl'].forEach(key => delete safeDraft[key]);
  
  const user = auth.currentUser;
  // Always persist local backup
  try {
    localStorage.setItem(getLocalDraftKey(user?.uid), JSON.stringify({
      formData: safeDraft,
      applicationId: applicationId || `draft_${user?.uid || 'local'}`,
      updatedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.warn('LocalStorage draft write error:', e);
  }

  try {
    return await request('draft', { formData: safeDraft, applicationId }, { force });
  } catch (err) {
    console.info('Saved draft locally in browser storage:', err.message);
    return {
      success: true,
      localOnly: true,
      applicationId: applicationId || `draft_${user?.uid || 'local'}`,
    };
  }
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

const admissionWorkflowApi = { loadAdmissionWorkspace, saveAdmissionDraft, submitAdmission, withdrawAdmission };
export default admissionWorkflowApi;
