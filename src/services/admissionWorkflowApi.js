import { getToken as getAppCheckToken } from 'firebase/app-check';
import { auth, db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseAppCheck } from './firebaseAppCheck';

const ENDPOINT = '/.netlify/functions/admission-workflow';
const SERVICE_COOLDOWN_MS = 60 * 1000;
let serviceUnavailableUntil = 0;
let cachedServiceError = null;

function isLocalEnvironment() {
  return typeof window !== 'undefined' &&
    (process.env.NODE_ENV === 'development' || ['localhost', '127.0.0.1'].includes(window.location.hostname));
}

function workflowError(message, status = 0, fieldErrors = {}) {
  const error = new Error(message);
  error.status = status;
  error.fieldErrors = fieldErrors;
  error.isServiceUnavailable = status === 0 || status === 404 || status >= 500;
  return error;
}

async function request(action, payload = {}, { force = false } = {}) {
  if (isLocalEnvironment() && action === 'draft') {
    return { success: true, localOnly: true, applicationId: payload.applicationId || 'draft_local' };
  }

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

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ action, ...payload }),
    });
  } catch (cause) {
    if (isLocalEnvironment()) {
      return { success: true, localOnly: true, isLocalFallback: true };
    }
    const error = workflowError('The admission service could not be reached. Check your connection and try again.');
    error.cause = cause;
    cachedServiceError = error;
    serviceUnavailableUntil = Date.now() + SERVICE_COOLDOWN_MS;
    throw error;
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (isLocalEnvironment() && (response.status === 404 || response.status === 0)) {
      return { success: true, localOnly: true, isLocalFallback: true, ...result };
    }
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
    if (err.isServiceUnavailable || err.status === 404 || isLocalEnvironment()) {
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
  try {
    return await request('submit', {
      formData: cleanFormData,
      photo,
      applicationId,
      submissionKey,
      upgradeMode,
    });
  } catch (err) {
    if (err.isServiceUnavailable || err.status === 404 || isLocalEnvironment()) {
      console.warn('Admission Netlify workflow function unavailable, submitting directly to Firestore:', err);
      const user = auth.currentUser;
      const formNo = String(cleanFormData['Form Number'] || cleanFormData['FormNo'] || cleanFormData.formNo || `25${String(Date.now()).slice(-4)}`);
      const payload = {
        ...cleanFormData,
        ownerUid: user?.uid || cleanFormData.ownerUid,
        emailNormalized: (user?.email || cleanFormData['Email Address'] || '').toLowerCase().trim(),
        'Form Number': formNo,
        Status: 'Submitted',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (photo) {
        payload['Student Photo'] = photo;
        payload.photo_id = photo;
        payload.photoUrl = photo;
      }
      await setDoc(doc(db, 'admissions', formNo), payload, { merge: true });
      return {
        success: true,
        'Form Number': formNo,
        message: 'Application submitted successfully!',
        data: payload,
      };
    }
    throw err;
  }
}

export async function withdrawAdmission(applicationId) {
  try {
    return await request('withdraw', { applicationId });
  } catch (err) {
    if (err.isServiceUnavailable || err.status === 404 || isLocalEnvironment()) {
      if (applicationId) {
        try {
          await setDoc(doc(db, 'admissions', String(applicationId)), {
            Status: 'Withdrawn',
            status: 'Withdrawn',
            withdrawnAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          return { success: true, message: 'Application withdrawn successfully.' };
        } catch (fsErr) {
          console.warn('Firestore direct withdrawal write note:', fsErr);
        }
      }
    }
    throw err;
  }
}

const admissionWorkflowApi = { loadAdmissionWorkspace, saveAdmissionDraft, submitAdmission, withdrawAdmission };
export default admissionWorkflowApi;
