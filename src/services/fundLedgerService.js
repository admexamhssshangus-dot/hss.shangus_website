import { staffCallable } from './staffCommand';

export async function mutateFundDistribution(action, record) {
  return (await staffCallable('mutateFundDistribution')({ action, id: record.id, record })).data;
}
