import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
export async function getStaffDirectory() {
  const { data } = await httpsCallable(functions, 'staffDirectory')({});
  const docs = data.users.map(user => ({ id: user.uid, data: () => user }));
  return { docs, empty: !docs.length, forEach: callback => docs.forEach(callback) };
}
export async function updateStaffPhone(uid, phone) {
  return (await httpsCallable(functions, 'staffDirectory')({ action: 'phone', uid, phone })).data;
}
