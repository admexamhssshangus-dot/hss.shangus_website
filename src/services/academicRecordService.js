import { staffCallable } from './staffCommand';

export async function saveAcademicRecord(type, docId, payload) {
  return (await staffCallable('submitAcademicRecord')({ type, docId, payload })).data;
}
export async function deleteAcademicRecord(type, docId) {
  return (await staffCallable('submitAcademicRecord')({ type, docId, action: 'delete' })).data;
}
