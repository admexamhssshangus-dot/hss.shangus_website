import { auth, db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import appsScriptApi from './appsScriptApi';

function getLocalDraftKey(uid = 'guest') {
  return `hss_student_draft_${uid}`;
}

const LOCAL_DRAFT_TTL_MS = 30 * 60 * 1000;

export async function loadAdmissionWorkspace() {
  const user = auth.currentUser;
  try {
    const raw = sessionStorage.getItem(getLocalDraftKey(user?.uid));
    if (raw) {
      const parsed = JSON.parse(raw);
      const updatedAt = Date.parse(parsed?.updatedAt || '');
      if (Number.isFinite(updatedAt) && Date.now() - updatedAt <= LOCAL_DRAFT_TTL_MS) {
        return { application: parsed, admissionWindow: { isOpen: true }, isLocalFallback: true };
      }
      sessionStorage.removeItem(getLocalDraftKey(user?.uid));
    }
  } catch (e) {
    console.warn('Local draft load error:', e);
  }
  return { application: null, admissionWindow: { isOpen: true }, isLocalFallback: true };
}

export async function saveAdmissionDraft({ formData, applicationId, force = false }) {
  const safeDraft = { ...formData };
  const user = auth.currentUser;

  // Authoritatively save draft directly to Firestore using sequential form numbers
  try {
    const res = await appsScriptApi.saveApplication({
      ...safeDraft,
      Status: 'Draft',
      status: 'Draft',
      applicationId: applicationId || safeDraft['Form Number'] || safeDraft.formNo || '',
    });

    const assignedNo = res.formNumber || res.applicationId || applicationId;

    // Update tab-scoped recovery copy
    try {
      localStorage.removeItem(getLocalDraftKey(user?.uid));
      sessionStorage.setItem(getLocalDraftKey(user?.uid), JSON.stringify({
        formData: { ...safeDraft, 'Form Number': assignedNo, FormNo: assignedNo, formNo: assignedNo },
        applicationId: assignedNo,
        updatedAt: new Date().toISOString(),
      }));
    } catch (e) {}

    return {
      success: true,
      applicationId: assignedNo,
      formNumber: assignedNo,
      data: res.data || safeDraft,
    };
  } catch (err) {
    console.warn('Draft save fallback:', err);
    return {
      success: true,
      localOnly: true,
      applicationId: applicationId || safeDraft['Form Number'] || safeDraft.formNo || '',
      formNumber: safeDraft['Form Number'] || safeDraft.formNo || '',
    };
  }
}

export async function submitAdmission({ formData, applicationId, submissionKey, upgradeMode = false }) {
  const user = auth.currentUser;
  try {
    const res = await appsScriptApi.saveApplication({
      ...formData,
      Status: 'Submitted',
      status: 'Submitted',
      applicationId: applicationId || formData['Form Number'] || formData.formNo || '',
      submissionKey,
      _upgradeMode: upgradeMode,
    });

    // Clear local draft caches upon successful submission
    try {
      localStorage.removeItem(getLocalDraftKey(user?.uid));
      sessionStorage.removeItem(getLocalDraftKey(user?.uid));
      sessionStorage.removeItem('hss_admission_draft');
      sessionStorage.removeItem('hss_admission_upgrade');
    } catch (e) {}

    return {
      success: true,
      applicationId: res.formNumber || res.applicationId,
      formNumber: res.formNumber,
      data: res.data || formData,
      message: res.message || 'Application submitted successfully!',
    };
  } catch (err) {
    console.error('submitAdmission error:', err);
    throw err;
  }
}

export async function withdrawAdmission(applicationId) {
  if (!applicationId) return { success: false, message: 'Application ID required.' };
  const user = auth.currentUser;
  try {
    const sanitizedId = String(applicationId).replace(/\//g, '_').trim();
    const updatePayload = {
      Status: 'Withdrawn',
      status: 'Withdrawn',
      withdrawnAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      withdrawnBy: user?.email || 'Student Self Withdrawal',
    };
    await setDoc(doc(db, 'admissions', sanitizedId), updatePayload, { merge: true });

    // Also update raw numeric form number doc ID if different
    const numericOnly = sanitizedId.replace(/[^0-9]/g, '');
    if (numericOnly && numericOnly !== sanitizedId) {
      setDoc(doc(db, 'admissions', numericOnly), updatePayload, { merge: true }).catch(() => {});
    }

    try {
      const { updateCachedItem } = require('./dbCache');
      updateCachedItem('admissions', sanitizedId, updatePayload);
      if (numericOnly) updateCachedItem('admissions', numericOnly, updatePayload);
    } catch (_) {}

    try {
      localStorage.removeItem(getLocalDraftKey(user?.uid));
      sessionStorage.removeItem(getLocalDraftKey(user?.uid));
      sessionStorage.removeItem('hss_admission_draft');
      sessionStorage.removeItem('hss_admission_upgrade');
    } catch (e) {}

    return { success: true, message: 'Application withdrawn successfully.' };
  } catch (err) {
    console.error('withdrawAdmission error:', err);
    throw err;
  }
}

const admissionWorkflowApi = { loadAdmissionWorkspace, saveAdmissionDraft, submitAdmission, withdrawAdmission };
export default admissionWorkflowApi;
