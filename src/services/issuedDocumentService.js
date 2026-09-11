import { staffCallable } from './staffCommand';

import { recordLocator } from '../utils/recordIdentity';
export async function registerIssuedDocument(student, certificateNo, documentType, action = 'issue') {
  return (await staffCallable('manageIssuedDocument')({ locator: recordLocator(student), certificateNo, documentType, action })).data;
}
