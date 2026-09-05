export function portalArea(role) {
  const normalized = String(role || '').toLowerCase().replace(/\s+/g, '');
  if (['admin', 'superadmin'].includes(normalized)) return 'admin';
  if (['teacher', 'faculty', 'staff'].includes(normalized)) return 'teacher';
  if (['student', 'user'].includes(normalized)) return 'student';
  return null;
}
