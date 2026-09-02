// =================================================================
// HSS SHANGUS — Document Studio Templates & Firebase Cloud Sync Service
// Handles cloud storage for Official Letter & Certificate Templates and Defaults
// =================================================================

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';

const COLLECTION_DOC_TEMPLATES = 'docStudioTemplates';
const SETTINGS_DOC_STUDIO = 'docStudioDefaults';
const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000;
const templateMemoryCache = new Map();
const templateInflightFetches = new Map();

function invalidateTemplateMemoryCache(type) {
  templateMemoryCache.delete(type);
}

/**
 * Fetch all cloud custom templates for a specific module ('letter' | 'certificate').
 * Merges with local storage cache for maximum performance.
 * 
 * @param {'letter' | 'certificate'} type
 * @returns {Promise<{ templates: Array<object>, defaultTemplateId: string | null }>}
 */
async function fetchCloudDocTemplatesFresh(type = 'letter') {
  const localCacheKey = type === 'letter' ? 'hss_custom_letter_templates' : 'hss_custom_certificate_templates';
  const localDefaultKey = type === 'letter' ? 'hss_default_letter_template_id' : 'hss_default_cert_template_id';
  
  let cachedTemplates = [];
  let defaultTemplateId = null;

  try {
    const raw = localStorage.getItem(localCacheKey);
    if (raw) cachedTemplates = JSON.parse(raw) || [];
    defaultTemplateId = localStorage.getItem(localDefaultKey) || null;
  } catch (e) {
    console.error('Error reading local template cache:', e);
  }

  try {
    // 1. Fetch default setting from Firebase
    const settingsRef = doc(db, 'systemSettings', SETTINGS_DOC_STUDIO);
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      if (type === 'letter' && data.defaultLetterTemplateId) {
        defaultTemplateId = data.defaultLetterTemplateId;
        localStorage.setItem(localDefaultKey, defaultTemplateId);
      } else if (type === 'certificate' && data.defaultCertificateTemplateId) {
        defaultTemplateId = data.defaultCertificateTemplateId;
        localStorage.setItem(localDefaultKey, defaultTemplateId);
      } else {
        defaultTemplateId = null;
        localStorage.removeItem(localDefaultKey);
      }
    } else {
      defaultTemplateId = null;
      localStorage.removeItem(localDefaultKey);
    }

    // 2. Filter in Firestore so each studio downloads only its own templates.
    // Equality queries use Firestore's automatic single-field index.
    const templatesQuery = query(
      collection(db, COLLECTION_DOC_TEMPLATES),
      where('type', '==', type)
    );
    const snapshot = await getDocs(templatesQuery);
    const cloudTemplates = [];

    snapshot.forEach(docSnap => {
      const tpl = docSnap.data();
      if (tpl) {
        cloudTemplates.push({
          ...tpl,
          id: docSnap.id
        });
      }
    });

    // A successful cloud response is authoritative, including an empty list.
    // Local data is retained only as an offline/error fallback.
    const cloudList = cloudTemplates.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    localStorage.setItem(localCacheKey, JSON.stringify(cloudList));
    return { templates: cloudList, defaultTemplateId };
  } catch (err) {
    console.warn('Firebase template fetch error (using local cache):', err);
  }

  return { templates: cachedTemplates, defaultTemplateId };
}

export async function fetchCloudDocTemplates(type = 'letter') {
  const cached = templateMemoryCache.get(type);
  if (cached && Date.now() - cached.fetchedAt < TEMPLATE_CACHE_TTL_MS) {
    return cached.value;
  }
  if (templateInflightFetches.has(type)) return templateInflightFetches.get(type);

  const request = fetchCloudDocTemplatesFresh(type)
    .then((value) => {
      templateMemoryCache.set(type, { value, fetchedAt: Date.now() });
      return value;
    })
    .finally(() => templateInflightFetches.delete(type));

  templateInflightFetches.set(type, request);
  return request;
}

/**
 * Save or update a document template in Firestore and localStorage.
 * Optionally sets it as the active default template.
 * 
 * @param {object} params
 * @param {'letter' | 'certificate'} params.type
 * @param {object} params.template
 * @param {boolean} [params.makeDefault]
 */
export async function saveCloudDocTemplate({ type = 'letter', template, makeDefault = true }) {
  if (!template || !template.name) {
    throw new Error('Template name is required.');
  }

  const templateId = template.id || `tpl_${type}_${Date.now()}`;
  const nowIso = new Date().toISOString();

  const payload = {
    id: templateId,
    type,
    name: template.name.trim(),
    category: template.category?.trim() || (type === 'letter' ? 'Official Orders' : 'Bonafide Certificates'),
    desc: template.desc?.trim() || '',
    refNo: template.refNo || '',
    bodyHtml: template.bodyHtml || '',
    copyTo: template.copyTo || '',
    isCustom: true,
    createdAt: template.createdAt || nowIso,
    updatedAt: nowIso
  };

  const localCacheKey = type === 'letter' ? 'hss_custom_letter_templates' : 'hss_custom_certificate_templates';
  const localDefaultKey = type === 'letter' ? 'hss_default_letter_template_id' : 'hss_default_cert_template_id';

  // 1. Immediately update localStorage for snappy UI
  try {
    const raw = localStorage.getItem(localCacheKey);
    let list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(t => t.id === templateId);
    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list = [payload, ...list];
    }
    localStorage.setItem(localCacheKey, JSON.stringify(list));

    if (makeDefault) {
      localStorage.setItem(localDefaultKey, templateId);
    }
  } catch (e) {
    console.error('Local cache error:', e);
  }

  // 2. Persist to Cloud Firestore
  try {
    const docRef = doc(db, COLLECTION_DOC_TEMPLATES, templateId);
    await setDoc(docRef, {
      ...payload,
      _serverTimestamp: serverTimestamp()
    }, { merge: true });

    if (makeDefault) {
      const settingsRef = doc(db, 'systemSettings', SETTINGS_DOC_STUDIO);
      const updateField = type === 'letter'
        ? { defaultLetterTemplateId: templateId }
        : { defaultCertificateTemplateId: templateId };

      await setDoc(settingsRef, {
        ...updateField,
        _lastUpdated: serverTimestamp()
      }, { merge: true });
    }
  } catch (err) {
    console.error('Failed to save template to Firebase:', err);
    throw err;
  }

  invalidateTemplateMemoryCache(type);

  return payload;
}

/**
 * Set a template as default in Firebase and localStorage.
 * 
 * @param {string} templateId
 * @param {'letter' | 'certificate'} type
 */
export async function setCloudDefaultTemplate(templateId, type = 'letter') {
  const localDefaultKey = type === 'letter' ? 'hss_default_letter_template_id' : 'hss_default_cert_template_id';
  try {
    localStorage.setItem(localDefaultKey, templateId);
  } catch (e) {
    console.error(e);
  }

  try {
    const settingsRef = doc(db, 'systemSettings', SETTINGS_DOC_STUDIO);
    const updateField = type === 'letter'
      ? { defaultLetterTemplateId: templateId }
      : { defaultCertificateTemplateId: templateId };

    await setDoc(settingsRef, {
      ...updateField,
      _lastUpdated: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error('Failed to update default template in Firebase:', err);
  }
  invalidateTemplateMemoryCache(type);
}

/**
 * Delete a template from Firestore and localStorage.
 * 
 * @param {string} templateId
 * @param {'letter' | 'certificate'} type
 */
export async function deleteCloudDocTemplate(templateId, type = 'letter') {
  const localCacheKey = type === 'letter' ? 'hss_custom_letter_templates' : 'hss_custom_certificate_templates';
  const localDefaultKey = type === 'letter' ? 'hss_default_letter_template_id' : 'hss_default_cert_template_id';

  // 1. Remove from localStorage
  try {
    const raw = localStorage.getItem(localCacheKey);
    if (raw) {
      const list = JSON.parse(raw) || [];
      const updated = list.filter(t => t.id !== templateId);
      localStorage.setItem(localCacheKey, JSON.stringify(updated));
    }
    const currentDefault = localStorage.getItem(localDefaultKey);
    if (currentDefault === templateId) {
      localStorage.removeItem(localDefaultKey);
    }
  } catch (e) {
    console.error(e);
  }

  // 2. Delete from Firestore
  try {
    const docRef = doc(db, COLLECTION_DOC_TEMPLATES, templateId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete template from Firebase:', err);
    throw err;
  }
  invalidateTemplateMemoryCache(type);
}
