const PUBLIC_FACULTY_LIMITS = Object.freeze({
  name: 120,
  designation: 120,
  subject: 120,
  department: 80,
  photo: 500000,
});

function cleanString(value, maxLength) {
  return String(value || '')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? ' ' : character;
    })
    .join('')
    .trim()
    .slice(0, maxLength);
}

function safePhoto(value) {
  if (!value || typeof value !== 'string') return '';
  const photo = value.trim();
  if (photo.length > PUBLIC_FACULTY_LIMITS.photo) return '';
  if (/^\/slides\/[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp|gif)$/i.test(photo)) return photo;
  if (/^https?:\/\//i.test(photo)) return photo;
  if (/^data:image\/(?:jpe?g|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(photo)) return photo;
  return '';
}

export function toPublicFacultyMember(member, index = 0) {
  if (!member || typeof member !== 'object' || member.hidden === true) return null;

  const orderVal = typeof member.order === 'number'
    ? member.order
    : (typeof index === 'number' ? index : 0);

  const projected = {
    name: cleanString(member.name, PUBLIC_FACULTY_LIMITS.name),
    designation: cleanString(member.designation, PUBLIC_FACULTY_LIMITS.designation),
    subject: cleanString(member.subject, PUBLIC_FACULTY_LIMITS.subject),
    department: cleanString(member.department, PUBLIC_FACULTY_LIMITS.department),
    photo: safePhoto(member.photo),
    order: orderVal,
  };

  return projected.name && projected.designation ? projected : null;
}

export function toPublicFacultyList(faculty) {
  if (!Array.isArray(faculty)) return [];
  return faculty
    .map((m, idx) => toPublicFacultyMember(m, typeof m?.order === 'number' ? m.order : idx))
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 150);
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function publicFacultyDocumentId(member, index = 0) {
  const orderNum = typeof member?.order === 'number' ? member.order : index;
  const prefix = String(orderNum).padStart(4, '0');
  const base = cleanString(`${member?.name || ''}-${member?.designation || ''}`, 160)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 65) || 'staff';
  return `${prefix}-${base}-${stableHash(`${base}:${index}`)}`.slice(0, 96);
}

export { PUBLIC_FACULTY_LIMITS };
