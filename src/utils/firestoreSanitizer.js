/**
 * Recursively cleans an object or array for Firestore writes.
 * Strips all keys whose values are `undefined` (which Firestore setDoc/updateDoc rejects).
 * Preserves Date objects, FieldValues, arrays, nulls, and primitives.
 */
export function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;

  // Preserve Firestore Timestamp, Date, or special Firestore sentinel objects
  if (obj instanceof Date) return obj;
  if (typeof obj.toMillis === 'function') return obj;

  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => (typeof item === 'object' && item !== null ? sanitizeForFirestore(item) : item));
  }

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = (typeof val === 'object' && val !== null) ? sanitizeForFirestore(val) : val;
    }
  }
  return clean;
}

export default sanitizeForFirestore;
