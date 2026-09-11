import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { recordLocator } from '../utils/recordIdentity';
export async function registerIssuedDocument(student, certificateNo, documentType, action = 'issue') {
  return (await httpsCallable(functions, 'manageIssuedDocument')({ locator: recordLocator(student), certificateNo, documentType, action })).data;
}
