import { staffCallable } from './staffCommand';

export async function getStaffDirectory() {
  const { data } = await staffCallable('staffDirectory')({});
  const docs = data.users.map(user => ({ id: user.uid, data: () => user }));
  return { docs, empty: !docs.length, forEach: callback => docs.forEach(callback) };
}
export async function updateStaffPhone(uid, phone) {
  return (await staffCallable('staffDirectory')({ action: 'phone', uid, phone })).data;
}
