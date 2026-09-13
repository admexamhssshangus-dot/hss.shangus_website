import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { staffCallable } from './staffCommand';

export async function getStaffDirectory() {
  const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

  // In local development, read directly from Firestore first to avoid cross-origin 503 network console warnings
  if (isLocal) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        const docs = snap.docs.filter(d => {
          const u = d.data();
          const role = String(u.role || '').toLowerCase();
          return ['teacher', 'faculty', 'examiner', 'staff', 'admin'].includes(role);
        });
        if (docs.length > 0) {
          return { docs, empty: false, forEach: callback => docs.forEach(callback) };
        }
      }
    } catch (dbErr) {
      console.warn('Local Firestore users query note:', dbErr?.message || dbErr);
    }
  }

  // Attempt backend staff command service
  try {
    const { data } = await staffCallable('staffDirectory')({});
    if (data && Array.isArray(data.users)) {
      const docs = data.users.map(user => ({ id: user.uid, data: () => user }));
      return { docs, empty: !docs.length, forEach: callback => docs.forEach(callback) };
    }
  } catch (err) {
    console.warn('Staff backend command unavailable, falling back to Firestore users:', err?.message || err);
  }

  // Tier-2 Direct Firestore Fallback for production when backend is sleeping
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (!snap.empty) {
      const docs = snap.docs.filter(d => {
        const u = d.data();
        const role = String(u.role || '').toLowerCase();
        return ['teacher', 'faculty', 'examiner', 'staff', 'admin'].includes(role);
      });
      return { docs, empty: !docs.length, forEach: callback => docs.forEach(callback) };
    }
  } catch (dbErr) {
    console.warn('Firestore users fallback error:', dbErr?.message || dbErr);
  }

  return { docs: [], empty: true, forEach: () => {} };
}

export async function updateStaffPhone(uid, phone) {
  try {
    return (await staffCallable('staffDirectory')({ action: 'phone', uid, phone })).data;
  } catch (err) {
    console.warn('updateStaffPhone note:', err?.message || err);
    throw err;
  }
}
