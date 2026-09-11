import { staffCallable } from './staffCommand';
import { recordLocator } from '../utils/recordIdentity';
import { db, auth } from './firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');

function normalizeDocType(value) {
  const text = String(value || '').replace(/\s*\([^)]*\)/g, '').trim().slice(0, 32).toLowerCase();
  return /discharge|transfer|tc\s*\/\s*dc|character.*discharg/.test(text) ? 'tc-dc' : text;
}

async function sha256Hex(str) {
  if (typeof crypto !== 'undefined' && crypto?.subtle?.digest) {
    const buf = new TextEncoder().encode(str);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

export async function registerIssuedDocument(student, certificateNo, documentType, action = 'issue') {
  try {
    const res = await staffCallable('manageIssuedDocument')({ locator: recordLocator(student), certificateNo, documentType, action });
    return res.data;
  } catch (callableErr) {
    console.warn('manageIssuedDocument callable unavailable, using direct Firestore on Spark plan:', callableErr?.message || callableErr);
    if (!auth.currentUser) {
      throw new Error('Authenticated staff session required.');
    }

    const reg = String(
      student?.boardRegNo || student?.regNo || student?.['Board Registration Number'] ||
      student?.['Board Reg. No.'] || student?.['Board Reg No'] || ''
    ).trim();
    const cleanCertNo = String(certificateNo || '').trim();
    const cleanDocType = normalizeDocType(documentType);

    if (!cleanCertNo || !cleanDocType) {
      return { success: false, error: 'Certificate number and document type required' };
    }

    const docId = await sha256Hex(`${normalize(cleanCertNo)}::${cleanDocType}::${normalize(reg)}`);
    const docRef = doc(db, 'issuedDocuments', docId);

    const locator = recordLocator(student);
    const sourceDocument = locator?.collection && locator?.documentId
      ? `${locator.collection}/${locator.documentId}`
      : 'admissions/unknown';

    if (action === 'revoke') {
      await updateDoc(docRef, {
        status: 'Revoked',
        revokedAt: new Date().toISOString(),
        revokedBy: auth.currentUser.uid,
      });
      return { success: true, id: docId, status: 'Revoked' };
    }

    const entry = {
      certificateNo: cleanCertNo,
      documentType: cleanDocType,
      regNo: reg,
      sourceDocument,
      status: 'Active',
      session: String(student?.Session || student?.session || student?.['Academic Session'] || ''),
      className: String(student?.classCanonical || student?.Class || student?.className || student?.class || ''),
      issueDate: new Date().toISOString().slice(0, 10),
      issuedAt: new Date().toISOString(),
      issuedBy: auth.currentUser.uid,
    };

    await setDoc(docRef, entry, { merge: true });
    return { success: true, id: docId, ...entry };
  }
}
