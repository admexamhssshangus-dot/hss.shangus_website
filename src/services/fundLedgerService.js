import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
export async function mutateFundDistribution(action, record) {
  return (await httpsCallable(functions, 'mutateFundDistribution')({ action, id: record.id, record })).data;
}
