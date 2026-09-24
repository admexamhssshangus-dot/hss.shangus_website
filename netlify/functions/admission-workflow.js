'use strict';

const crypto = require('crypto');
const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getAppCheck } = require('firebase-admin/app-check');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const ALLOWED_CLASSES = new Set(['9th', '10th', '11th', '12th']);
const PROTECTED_FIELDS = new Set([
  'ownerUid', 'uid', 'createdBy', 'createdAt', 'updatedAt', 'submittedAt',
  'reviewedAt', 'approvedAt', 'rejectedAt', 'editableUntil', 'Status', 'status',
  'Form Number', 'FormNo', 'Form No.', 'formNo', 'formNumber', 'admissionNumber',
  'approvedBy', 'rejectedBy', 'reviewedBy', 'workflowVersion', 'submissionKey',
  'classCanonical', 'sessionCanonical', 'emailNormalized', 'photoPath',
  'applicationId', 'docId', 'registrationNoCanonical', 'photoRef', 'photoBand',
]);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const { parseServiceAccount } = require('./lib/serviceAccount');

function getAdminApp() {
  if (getApps().length) return getApp();
  const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  return initializeApp({ credential: cert(serviceAccount) });
}

function response(statusCode, body, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return { statusCode, headers, body: JSON.stringify(body) };
}

function allowedOrigin(event) {
  const origin = String(event.headers.origin || '').replace(/\/$/, '');
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin;
  }
  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean);
  const defaults = [process.env.URL, process.env.DEPLOY_PRIME_URL, 'https://hssshangus.in', 'https://www.hssshangus.in', 'https://hssshangus.netlify.app']
    .filter(Boolean).map(v => String(v).replace(/\/$/, ''));
  return origin && [...configured, ...defaults].includes(origin) ? origin : '';
}

async function authenticate(event) {
  getAdminApp();
  const header = String(event.headers.authorization || '');
  if (!header.startsWith('Bearer ')) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  const decoded = await getAuth(getAdminApp()).verifyIdToken(header.slice(7), true);
  const role = String(decoded.role || '').toLowerCase();
  if (!['student', 'user'].includes(role)) {
    const email = String(decoded.email || '').toLowerCase();
    const uid = decoded.uid;
    const db = getFirestore(getAdminApp());
    let profile = uid ? await db.collection('users').doc(uid).get() : null;
    if (!profile?.exists && email) {
      profile = await db.collection('users').doc(email).get();
    }
    const profileRole = profile?.exists ? String(profile.data().role || profile.data().Role || profile.data().requestedRole || '').toLowerCase() : 'student';
    if (!['student', 'user', ''].includes(profileRole)) {
      throw Object.assign(new Error('A registered student account is required.'), { status: 403 });
    }
  }
  if (process.env.REQUIRE_VERIFIED_STUDENT_EMAIL === 'true' && decoded.email_verified !== true) {
    throw Object.assign(new Error('Please verify your email address before using admissions.'), { status: 403 });
  }
  if (process.env.REQUIRE_APP_CHECK === 'true') {
    const appCheckToken = String(event.headers['x-firebase-appcheck'] || '');
    if (!appCheckToken) throw Object.assign(new Error('App verification is required.'), { status: 401 });
    await getAppCheck(getAdminApp()).verifyToken(appCheckToken);
  }
  return decoded;
}

function cleanString(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function sanitizeValue(value, depth = 0) {
  if (depth > 3 || value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e9 ? value : undefined;
  if (typeof value === 'string') {
    if (/^data:/i.test(value)) return undefined;
    return cleanString(value, 3000);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 40).map(v => sanitizeValue(v, depth + 1)).filter(v => v !== undefined);
  }
  if (typeof value === 'object') {
    const result = {};
    Object.entries(value).slice(0, depth === 0 ? 180 : 80).forEach(([key, child]) => {
      const safeKey = cleanString(key, 120);
      if (!safeKey || safeKey.startsWith('_') || PROTECTED_FIELDS.has(safeKey)) return;
      const safeValue = sanitizeValue(child, depth + 1);
      if (safeValue !== undefined) result[safeKey] = safeValue;
    });
    return result;
  }
  return undefined;
}

function validatedPhoto(value) {
  const photo = String(value || '').trim();
  if (/^https:\/\//i.test(photo) && photo.length <= 2048) return photo;
  const match = photo.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return '';
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 100 || bytes.length > 100 * 1024) return '';
  const mime = match[1].toLowerCase();
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(pngSignature);
  const webp = bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if ((mime === 'jpeg' && !jpeg) || (mime === 'png' && !png) || (mime === 'webp' && !webp)) return '';
  return photo;
}

function normalizeClass(value) {
  const match = cleanString(value, 20).toLowerCase().match(/(9|10|11|12)/);
  return match ? `${match[1]}th` : '';
}

function normalizeSession(value) {
  const session = cleanString(value, 20).replace(/\s/g, '');
  const normalized = session.replace(/\u2013/g, '-');
  return /^20\d{2}-(?:20)?\d{2}$/.test(normalized) ? normalized : '';
}

// A board registration number identifies a student across every record.  The
// same number may have one record for each class/session, so it is deliberately
// combined with those values in the server-only application index below.
function normalizeRegistrationNumber(value) {
  const normalized = cleanString(value, 80).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return normalized.length >= 5 ? normalized : '';
}

function registrationNumberFrom(data) {
  const keys = [
    'Board Registration Number', 'Board Registration No.', 'Board Reg. No.',
    'Registration Number', 'Registration No.', 'Reg. No.', 'boardRegNo', 'regNo',
    'registrationNo', 'Board Registration No. (Class 9th)',
    'Board Registration No. (Class 10th)', 'Board Registration No. (Class 11th)',
    'Board Registration No. (Class 12th)', 'DIET Registration No.',
  ];
  for (const key of keys) {
    const candidate = normalizeRegistrationNumber(data?.[key]);
    if (candidate) return candidate;
  }
  return '';
}

function photoBandForClass(cls) {
  return cls === '9th' || cls === '10th' ? 'secondary' : 'higher-secondary';
}

function photoSourcePriority(cls) {
  // A lower score wins: 9th over 10th, and 11th over 12th.
  return cls === '9th' || cls === '11th' ? 0 : 1;
}

function applicationIndexId(registrationNo, session, cls) {
  // Keep the document id non-identifying while retaining an exact O(1) lookup.
  return crypto.createHash('sha256').update(`${registrationNo}|${session}|${cls}`).digest('hex');
}

function currentAcademicSession(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12 (Aug = 8, Oct = 10, Nov = 11)
  const day = now.getUTCDate();
  // Cutoff is Oct 31st:
  // Till Oct 31st 2026: Academic Session is 2025-26 (Prefix 25)
  // From Nov 1st 2026 onwards: Academic Session rolls over to 2026-27 (Prefix 26)
  const isPastCutoff = month > 10 || (month === 10 && day > 31);
  const sessionEndYear = isPastCutoff ? year + 1 : year;
  const sessionStartYear = sessionEndYear - 1;
  return `${sessionStartYear}-${String(sessionEndYear).slice(-2)}`;
}

function digits(value) { return String(value || '').replace(/\D/g, ''); }

// Verhoeff checksum used by Aadhaar numbers.
function validAadhaar(value) {
  const num = digits(value);
  if (!/^[2-9]\d{11}$/.test(num)) return false;
  const d = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
  const p = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
  let c = 0;
  [...num].reverse().forEach((n, i) => { c = d[c][p[i % 8][Number(n)]]; });
  return c === 0;
}

function strictIsoDate(value) {
  const str = cleanString(value, 30);
  if (!str) return null;
  // If ISO YYYY-MM-DD
  let match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    // If ISO YYYY-M-D or YYYY-3_Mar-DD
    const isoMatch = str.match(/^(\d{4})[-/](?:\d{1,2}_)?([a-zA-Z0-9]+)[-/](\d{1,2})$/);
    if (isoMatch) {
      const [, y, mStr, d] = isoMatch;
      const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
      const mNum = monthMap[mStr.toLowerCase()] || String(parseInt(mStr, 10) || '01').padStart(2, '0');
      match = [null, y, mNum, d.padStart(2, '0')];
    }
  }
  if (!match) {
    // If DD-MM-YYYY or D-M-YYYY or DD-3_Mar-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](?:\d{1,2}_)?([a-zA-Z0-9]+)[-/](\d{4})$/);
    if (dmyMatch) {
      const [, d, mStr, y] = dmyMatch;
      const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
      const mNum = monthMap[mStr.toLowerCase()] || String(parseInt(mStr, 10) || '01').padStart(2, '0');
      match = [null, y, mNum, d.padStart(2, '0')];
    }
  }
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function valueOf(data, ...keys) {
  for (const key of keys) if (data[key] !== undefined && data[key] !== null && String(data[key]).trim() !== '') return data[key];
  return '';
}

function validateSubmission(data, token) {
  const errors = {};
  const requiredText = (key, label, min = 1, max = 200) => {
    const val = cleanString(data[key], max);
    if (!val || val.length < min) {
      errors[key] = `${label} is required.`;
    } else if (String(data[key]).trim().length > max) {
      errors[key] = `${label} cannot exceed ${max} characters.`;
    }
  };

  const optionalText = (key, label, max = 200) => {
    const val = String(data[key] ?? '').trim();
    if (val && val.length > max) {
      errors[key] = `${label} cannot exceed ${max} characters.`;
    }
  };

  requiredText("Student's Name (as per school records)", 'Student name', 2, 60);
  requiredText("Father's/Guardian's Name (as per school records)", 'Father/guardian name', 2, 60);
  requiredText("Mother's Name (as per school records)", 'Mother name', 2, 60);
  requiredText('Name of your village', 'Village/locality', 2, 60);
  requiredText('District', 'District', 2, 60);
  optionalText('House No.', 'House No.', 30);
  optionalText('Identification Mark (if any)', 'Identification mark', 100);
  optionalText('Remarks/Feedback (if any)', 'Remarks', 300);
  optionalText('PEN number (given by UDISE portal)', 'PEN number', 12);
  optionalText('APAAR ID', 'APAAR ID', 16);
  optionalText('Passport No. (if available)', 'Passport number', 20);

  const cls = normalizeClass(data['Admission sought for class']);
  if (!ALLOWED_CLASSES.has(cls)) errors['Admission sought for class'] = 'Select a valid admission class.';
  const session = normalizeSession(valueOf(data, 'Session', 'session'));
  if (!session) errors.Session = 'A valid academic session is required.';

  const email = cleanString(valueOf(data, 'Email Address', 'email') || token.email, 80).toLowerCase();
  if (!EMAIL_RE.test(email) || (token.email && email !== String(token.email).toLowerCase())) {
    errors['Email Address'] = 'The application email must match the signed-in account.';
  } else if (email.length > 80) {
    errors['Email Address'] = 'Email address cannot exceed 80 characters.';
  }

  const mobile = digits(data['Mobile No. (with working WhatsApp)']);
  const parentMobile = digits(data["Parent's Mobile No. (must be working)"]);
  if (!/^[6-9]\d{9}$/.test(mobile)) errors['Mobile No. (with working WhatsApp)'] = 'Enter a valid 10-digit mobile number.';
  if (!/^[6-9]\d{9}$/.test(parentMobile)) errors["Parent's Mobile No. (must be working)"] = 'Enter a valid 10-digit parent mobile number.';
  if (mobile && mobile === parentMobile) errors["Parent's Mobile No. (must be working)"] = 'Student and parent mobile numbers must be different.';
  if (!validAadhaar(data['Aadhar No.'])) errors['Aadhar No.'] = 'Enter a valid 12-digit Aadhaar number with correct checksum.';
  if (!validAadhaar(data["Father's Aadhar No."])) errors["Father's Aadhar No."] = "Enter a valid 12-digit Father's Aadhaar number with correct checksum.";

  requiredText("Father's/Guardian's Occupation", "Father's occupation", 2, 60);
  if (data["Mother's Occupation"] !== undefined && String(data["Mother's Occupation"]).trim()) {
    requiredText("Mother's Occupation", "Mother's occupation", 2, 60);
  }

  const dob = cleanString(valueOf(data, 'DoB (as per school records)', 'DoB', 'dob'), 30);
  const dobDate = strictIsoDate(dob);
  const ageYears = dobDate && !Number.isNaN(dobDate.getTime()) ? (Date.now() - dobDate.getTime()) / 31557600000 : -1;
  const MIN_AGE_BY_CLASS = { '9th': 13, '10th': 14, '11th': 15, '12th': 16 };
  const minRequiredAge = MIN_AGE_BY_CLASS[cls] || 13;
  if (!dobDate || ageYears > 70) {
    errors['DoB (as per school records)'] = 'Enter a valid date of birth.';
  } else if (ageYears < minRequiredAge) {
    errors['DoB (as per school records)'] = `Minimum age for Class ${cls} admission is ${minRequiredAge} years (calculated age: ${Math.floor(ageYears)} yrs). Underage applicant.`;
  }

  if (!cleanString(data.Gender, 30)) errors.Gender = 'Gender is required.';
  const admissionType = cleanString(valueOf(data,
    cls === '12th' ? 'Admission Type (Class 12th)' : cls === '11th' ? 'Admission Type (Class 11th)' : 'Admission Type'), 30);
  if (!['Full', 'Provisional'].includes(admissionType)) errors['Admission Type'] = 'Select Full or Provisional admission.';

  if (cls === '11th') {
    if (!['Science', 'Humanities', 'Medical', 'Non-Medical', 'Arts', 'Commerce'].includes(cleanString(data['Stream for Class 11th'], 30))) {
      errors['Stream for Class 11th'] = 'Select a valid Class 11 stream.';
    }
    requiredText('Name of Previous School (Class 10th)', 'Previous school', 2, 120);
    requiredText('Board (Class 10th)', 'Class 10 board', 2, 60);
    requiredText('Subjects Studied in Class 10th', 'Class 10 subjects', 2, 250);
    const reason = cleanString(data['Reason for Provisional (Class 11th)'], 60);
    if (!(admissionType === 'Provisional' && reason === 'Reappear Candidate')) {
      requiredText('Board Registration No. (Class 10th)', 'Class 10 registration number', 2, 25);
    } else {
      requiredText('Subjects to Reappear (Class 10th)', 'Reappear subjects', 2, 200);
    }
  } else if (cls === '12th') {
    if (!cleanString(data['Stream opted in Class 11th'], 30)) errors['Stream opted in Class 11th'] = 'Class 11 stream is required.';
    requiredText('Name of Previous School (Class 11th)', 'Previous school', 2, 120);
    requiredText('Board (Class 11th)', 'Class 11 board', 2, 60);
    requiredText('Subjects Studied in Class 11th', 'Class 11 subjects', 2, 250);
    const reason = cleanString(data['Reason for Provisional (Class 12th)'], 60);
    if (!(admissionType === 'Provisional' && reason === 'Reappear Candidate')) {
      requiredText('Board Registration No. (Class 11th)', 'Class 11 registration number', 2, 25);
    } else {
      requiredText('Subjects to Reappear (Class 11th)', 'Reappear subjects', 2, 200);
    }
  } else if (cls === '10th') {
    requiredText('Board Registration No. (Class 9th)', 'Class 9 registration number', 2, 25);
    requiredText('Name of Previous School (Class 9th)', 'Previous school', 2, 120);
  } else if (cls === '9th') {
    requiredText('Name of Previous School (Class 8th)', 'Previous school', 2, 120);
    requiredText('Year of Passing Class 8th', 'Class 8 passing year', 2, 10);
  }

  const pin = digits(data['PIN code']);
  if (pin && !/^[1-9]\d{5}$/.test(pin)) errors['PIN code'] = 'Enter a valid 6-digit PIN code.';
  const bankAccount = cleanString(data['Bank Account No.'], 30).replace(/\s/g, '');
  if (!bankAccount || !/^\d{9,18}$/.test(bankAccount)) errors['Bank Account No.'] = 'Enter a valid 9-18 digit bank account number.';
  const ifsc = cleanString(data['IFSC code'], 20).toUpperCase();
  if (!ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) errors['IFSC code'] = 'Enter a valid 11-character IFSC code (e.g. SBIN0001234).';

  // Marks Validation (Mandatory for Full Admission)
  if (admissionType === 'Full' || admissionType === 'Regular') {
    const prevClassMarksKey = cls === '11th' ? 'Class 10th' : cls === '12th' ? 'Class 11th' : cls === '10th' ? 'Class 9th' : 'Class 8th';
    const obtKey = `Total Marks Obtained in ${prevClassMarksKey}`;
    const maxKey = `Total Max. Marks in ${prevClassMarksKey}`;
    const obtained = Number(data[obtKey]);
    const maximum = Number(data[maxKey]);
    if (!Number.isFinite(obtained) || obtained < 0) {
      errors[obtKey] = `Total marks obtained in ${prevClassMarksKey} is required for full admission.`;
    }
    if (!Number.isFinite(maximum) || maximum <= 0 || maximum > 2000) {
      errors[maxKey] = `Valid total maximum marks in ${prevClassMarksKey} is required (1–2000).`;
    }
    if (Number.isFinite(obtained) && Number.isFinite(maximum) && obtained > maximum) {
      errors[obtKey] = `Marks obtained (${obtained}) cannot exceed maximum marks (${maximum}).`;
    }
  }

  Object.keys(data).filter(k => /^Total Marks Obtained in /.test(k)).forEach(key => {
    const suffix = key.replace('Total Marks Obtained in ', '');
    const obtained = Number(data[key]);
    const maximum = Number(data[`Total Max. Marks in ${suffix}`]);
    if (data[key] !== undefined && data[key] !== '' && (!Number.isFinite(obtained) || obtained < 0 || !Number.isFinite(maximum) || maximum <= 0 || maximum > 2000 || obtained > maximum)) {
      errors[key] = 'Marks must be non-negative and cannot exceed valid maximum marks.';
    }
  });

  const photo = validatedPhoto(valueOf(data, 'photo_id', 'photoUrl', 'Student Photo'));
  if (!photo) errors['Student Photo'] = 'A valid compressed passport photograph is required.';
  if (Object.keys(errors).length) throw Object.assign(new Error('Please correct the highlighted admission fields.'), { status: 422, errors });
  return { cls, session, email, mobile };
}

async function consumeRateLimit(db, uid, action) {
  const ref = db.collection('securityRateLimits').doc(`admission_${uid}_${action}`);
  const now = Date.now();
  const windowMs = action === 'load' ? 60000 : action === 'lookup_registration' ? 60000 : 300000;
  const max = action === 'load' ? 30 : action === 'draft' ? 20 : action === 'lookup_registration' ? 25 : 6;
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const prior = snap.exists ? snap.data() : {};
    const resetAt = Number(prior.resetAt || 0);
    const count = resetAt > now ? Number(prior.count || 0) + 1 : 1;
    const nextReset = resetAt > now ? resetAt : now + windowMs;
    tx.set(ref, { count, resetAt: nextReset, expiresAt: Timestamp.fromMillis(nextReset + 86400000) });
    return count <= max;
  });
}

async function loadWorkspace(db, token) {
  const email = String(token.email || '').toLowerCase();
  const queries = [db.collection('admissions').where('ownerUid', '==', token.uid).get()];
  if (email && token.email_verified === true) {
    queries.push(db.collection('admissions').where('emailNormalized', '==', email).get());
    queries.push(db.collection('admissions').where('Email Address', '==', email).get());
  }
  const snapshots = await Promise.all(queries);
  const unique = new Map();
  snapshots.forEach(snap => snap.docs.forEach(doc => {
    const item = doc.data();
    const itemEmail = String(item.emailNormalized || item['Email Address'] || item.email || '').toLowerCase();
    if (item.ownerUid === token.uid || (!item.ownerUid && token.email_verified === true && email && itemEmail === email)) unique.set(doc.id, { docId: doc.id, ...item });
  }));
  const applications = [...unique.values()]
    .filter(item => !['Deleted', 'Withdrawn'].includes(item.Status) && item._deleted !== true)
    .sort((a, b) => {
      const time = v => v?.toMillis?.() || Date.parse(v || '') || 0;
      return time(b.updatedAt || b.submittedAt || b.createdAt) - time(a.updatedAt || a.submittedAt || a.createdAt);
    });
  // Photos live only in studentPhotos.  Hydrate the small, signed-in student's
  // workspace response instead of storing another base64 copy in admissions.
  const photoRefs = [...new Set(applications.map(item => String(item.photoRef || '')).filter(ref => /^studentPhotos\/[a-zA-Z0-9_-]{1,256}$/.test(ref)))];
  const photoSnapshots = await Promise.all(photoRefs.map(ref => db.doc(ref).get().catch(() => null)));
  const photosByRef = new Map();
  photoSnapshots.forEach((snap, index) => {
    const photo = snap?.exists ? validatedPhoto(snap.data()?.photo_id) : '';
    if (photo) photosByRef.set(photoRefs[index], photo);
  });
  applications.forEach(item => {
    const resolvedPhoto = photosByRef.get(item.photoRef);
    if (resolvedPhoto) item.photo_id = resolvedPhoto;
  });
  const [settingsSnap, counterSnap] = await Promise.all([
    db.collection('site').doc('settings').get(),
    db.collection('systemSettings').doc('formNumberConfig').get(),
  ]);
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const counter = counterSnap.exists ? counterSnap.data() : {};
  const activeSession = normalizeSession(
    settings.currentSession || settings.session || counter.currentSession || counter.session
  ) || currentAcademicSession();
  return {
    applications,
    activeSession,
    admissionAvailability: {
      globalClosed: settings.globalAdmissionsClosed === true,
      classesClosed: settings.admissionsClosed || {},
    },
  };
}

function toIsoDate(d) {
  if (!d) return '';
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return s;
}

async function lookupRegistrationRecord(db, token, body) {
  const rawReg = cleanString(body.registrationNo || '', 64);
  const cleanKey = rawReg.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanKey || cleanKey.length < 4) {
    throw Object.assign(new Error('Please enter a valid Board or DIET Registration Number (at least 4 characters).'), { status: 400 });
  }

  let foundRecord = null;
  let source = '';

  // 1. Search admissions collection
  const admQueries = [
    db.collection('admissions').where('registrationNoCanonical', '==', cleanKey).get(),
    db.collection('admissions').where('Board Registration Number', '==', rawReg).get(),
    db.collection('admissions').where('DIET Registration No.', '==', rawReg).get(),
    db.collection('admissions').where('Board Reg. No.', '==', rawReg).get(),
  ];
  const admSnaps = await Promise.all(admQueries);
  for (const snap of admSnaps) {
    if (!snap.empty) {
      const candidates = snap.docs
        .map(d => ({ docId: d.id, ...d.data() }))
        .filter(d => !['Deleted', 'Withdrawn'].includes(d.Status) && d._deleted !== true);
      if (candidates.length > 0) {
        foundRecord = candidates[0];
        source = 'admissions';
        break;
      }
    }
  }

  // 2. Search masterRegisters chunks if not found in admissions
  if (!foundRecord) {
    const masterSnaps = await db.collection('masterRegisters').get();
    for (const doc of masterSnaps.docs) {
      const data = doc.data();
      const items = Array.isArray(data.items) ? data.items : (data["Student's Name"] ? [data] : []);
      for (const it of items) {
        const itReg = String(it['Board Reg. No.'] || it['Board Registration Number'] || it['DIET Registration No.'] || it.boardRegNo || it.regNo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (itReg === cleanKey) {
          foundRecord = it;
          source = 'masterRegister';
          break;
        }
      }
      if (foundRecord) break;
    }
  }

  if (!foundRecord) {
    return {
      success: false,
      notFound: true,
      message: `No previous admission or master register record found matching Registration No. "${rawReg}". Please check the number or fill the form manually.`,
    };
  }

  // Hydrate photo if photoRef exists
  let resolvedPhoto = '';
  if (foundRecord.photoRef) {
    const pSnap = await db.doc(foundRecord.photoRef).get().catch(() => null);
    if (pSnap && pSnap.exists) {
      resolvedPhoto = validatedPhoto(pSnap.data()?.photo_id);
    }
  }
  if (!resolvedPhoto && foundRecord.photo_id) {
    resolvedPhoto = validatedPhoto(foundRecord.photo_id);
  }

  const studentName = cleanString(foundRecord["Student's Name (as per school records)"] || foundRecord["Student's Name"] || foundRecord.studentName || '', 100);
  const fatherName = cleanString(foundRecord["Father's/Guardian's Name (as per school records)"] || foundRecord["Father's Name"] || foundRecord.fatherName || '', 100);
  const motherName = cleanString(foundRecord["Mother's Name (as per school records)"] || foundRecord["Mother's Name"] || foundRecord.motherName || '', 100);
  const dob = toIsoDate(foundRecord["DoB (as per school records)"] || foundRecord["DoB (figures)"] || foundRecord.dob);
  const gender = cleanString(foundRecord["Gender"] || foundRecord.gender || '', 20);

  const prevClass = normalizeClass(foundRecord['Class'] || foundRecord['Admission sought for class'] || foundRecord.class || '');
  const prevSession = normalizeSession(foundRecord['Session'] || foundRecord.session || '');
  const prevStream = cleanString(foundRecord['Stream for Class 11th'] || foundRecord['Stream opted in Class 11th'] || foundRecord['Stream'] || '', 30);
  const prevRoll = cleanString(foundRecord['Exam R.No. (Current)'] || foundRecord.currExamRoll || foundRecord.examRollNo || foundRecord['Exam Roll Number of Class 10th'] || foundRecord['Exam Roll Number of Class 11th'] || '', 30);
  const prevMarks = cleanString(foundRecord['Marks/Reapp (Current)'] || foundRecord.marksObtained || foundRecord['Total Marks Obtained in Class 10th'] || foundRecord['Total Marks Obtained in Class 11th'] || '', 20);

  let suggestedClass = '';
  if (prevClass === '9th') suggestedClass = '10th';
  else if (prevClass === '10th') suggestedClass = '11th';
  else if (prevClass === '11th') suggestedClass = '12th';
  else if (prevClass === '12th') suggestedClass = '12th';

  const prefill = {
    // Identity & Parentage
    "Student's Name (as per school records)": studentName,
    "DoB (as per school records)": dob,
    "Gender": gender,
    "Father's/Guardian's Name (as per school records)": fatherName,
    "Father's/Guardian's Occupation": cleanString(foundRecord["Father's/Guardian's Occupation"] || foundRecord["Father's Occupation"] || '', 60),
    "Mother's Name (as per school records)": motherName,
    "Aadhar No.": digits(foundRecord["Aadhar No."] || foundRecord.aadharNo || foundRecord.aadhaar),
    "Father's Aadhar No.": digits(foundRecord["Father's Aadhar No."] || foundRecord.fatherAadhar),
    "Your Mother Tongue": cleanString(foundRecord["Your Mother Tongue"] || 'Kashmiri', 30),
    "Identification Mark (if any)": cleanString(foundRecord["Identification Mark (if any)"] || '', 100),

    // Contact & Residential Address
    "Mobile No. (with working WhatsApp)": digits(foundRecord["Mobile No. (with working WhatsApp)"] || foundRecord["Student's Contact"] || foundRecord.mobile || foundRecord.phone),
    "Parent's Mobile No. (must be working)": digits(foundRecord["Parent's Mobile No. (must be working)"] || foundRecord["Parent's Contact"] || foundRecord.parentMobile),
    "Email Address": cleanString(foundRecord["Email Address"] || foundRecord.email1 || foundRecord.email || '', 80),
    "House No.": cleanString(foundRecord["House No."] || '', 30),
    "Name of your village": cleanString(foundRecord["Name of your village"] || foundRecord["Village/Town"] || foundRecord["Residence (Village, District)"] || foundRecord.village || '', 60),
    "Block": cleanString(foundRecord["Block"] || foundRecord.block || '', 50),
    "Tehsil": cleanString(foundRecord["Tehsil"] || foundRecord.tehsil || '', 50),
    "District": cleanString(foundRecord["District"] || foundRecord.district || 'Anantnag', 50),
    "State/UT": cleanString(foundRecord["State/UT"] || 'Jammu and Kashmir', 50),
    "PIN code": digits(foundRecord["PIN code"] || foundRecord.pinCode || foundRecord.pincode),

    // Physical & Social
    "Height (cm)": cleanString(foundRecord["Height (cm)"] || foundRecord.height || '', 10),
    "Weight (kg)": cleanString(foundRecord["Weight (kg)"] || foundRecord.weight || '', 10),
    "Blood Group": cleanString(foundRecord["Blood Group"] || foundRecord["Blood Type"] || '', 15),
    "Religion": cleanString(foundRecord["Religion"] || foundRecord.religion || 'Islam', 30),
    "Social category": cleanString(foundRecord["Social category"] || foundRecord["Cat._JKBOSE"] || foundRecord.category || 'OM', 20),
    "Socio-economic category": cleanString(foundRecord["Socio-economic category"] || '', 30),
    "Whether Any Disability": (foundRecord["Whether Any Disability"] || foundRecord["Disability Status"]) === 'Yes' ? 'Yes' : 'No',
    "Type of Disability": cleanString(foundRecord["Type of Disability"] || foundRecord["Disability Type"] || '', 100),

    // National IDs
    "PEN number (given by UDISE portal)": cleanString(foundRecord["PEN number (given by UDISE portal)"] || foundRecord["PEN No."] || foundRecord.penNo || '', 20),
    "APAAR ID": cleanString(foundRecord["APAAR ID"] || foundRecord.apaarId || '', 20),
    "DIET Registration No.": cleanString(foundRecord["DIET Registration No."] || foundRecord.dietRegNo || (prevClass === '9th' ? rawReg : ''), 30),

    // Bank Details
    "Bank Account No.": cleanString(foundRecord["Bank Account No."] || foundRecord["Bank Account Number"] || foundRecord.bankAccount || '', 30).replace(/\s/g, ''),
    "Name of Bank": cleanString(foundRecord["Name of Bank"] || foundRecord["Bank Name"] || foundRecord.bankName || '', 80),
    "IFSC code": cleanString(foundRecord["IFSC code"] || foundRecord["IFSC Code"] || foundRecord.ifsc || '', 20).toUpperCase(),

    // Photo
    "Student Photo": resolvedPhoto || undefined,
    "photo_id": resolvedPhoto || undefined,
  };

  // Populate Class-Specific Academic Records
  if (suggestedClass === '12th' || prevClass === '11th') {
    prefill["Admission sought for class"] = '12th';
    prefill["Admission Type (Class 12th)"] = 'Full';
    prefill["Board Registration No. (Class 11th)"] = rawReg;
    prefill["Name of Previous School (Class 11th)"] = "Govt Higher Secondary School Shangus";
    prefill["Board (Class 11th)"] = "JKBOSE";
    if (prevStream) {
      prefill["Stream opted in Class 11th"] = prevStream;
      prefill["Stream for Class 11th"] = prevStream;
      prefill["Stream"] = prevStream;
    }
    if (prevRoll) prefill["Exam Roll Number of Class 11th"] = prevRoll;
    if (prevSession) prefill["Year of Passing Class 11th"] = prevSession;
    if (prevMarks) prefill["Total Marks Obtained in Class 11th"] = prevMarks;
    prefill["Total Max. Marks in Class 11th"] = '500';

    if (foundRecord["Board Registration No. (Class 10th)"]) prefill["Board Registration No. (Class 10th)"] = foundRecord["Board Registration No. (Class 10th)"];
    if (foundRecord["Exam Roll Number of Class 10th"]) prefill["Exam Roll Number of Class 10th"] = foundRecord["Exam Roll Number of Class 10th"];
    if (foundRecord["Year of Passing Class 10th"]) prefill["Year of Passing Class 10th"] = foundRecord["Year of Passing Class 10th"];
    if (foundRecord["Total Marks Obtained in Class 10th"]) prefill["Total Marks Obtained in Class 10th"] = foundRecord["Total Marks Obtained in Class 10th"];
    if (foundRecord["Total Max. Marks in Class 10th"]) prefill["Total Max. Marks in Class 10th"] = foundRecord["Total Max. Marks in Class 10th"];
    if (foundRecord["Name of Previous School (Class 10th)"]) prefill["Name of Previous School (Class 10th)"] = foundRecord["Name of Previous School (Class 10th)"];
    if (foundRecord["Board (Class 10th)"]) prefill["Board (Class 10th)"] = foundRecord["Board (Class 10th)"];
  } else if (suggestedClass === '11th' || prevClass === '10th') {
    prefill["Admission sought for class"] = '11th';
    prefill["Admission Type (Class 11th)"] = 'Full';
    prefill["Board Registration No. (Class 10th)"] = rawReg;
    prefill["Name of Previous School (Class 10th)"] = cleanString(foundRecord['Previous School'] || foundRecord['Name of Previous School (Class 10th)'] || "Govt Higher Secondary School Shangus", 120);
    prefill["Board (Class 10th)"] = "JKBOSE";
    if (prevStream && prevStream !== 'General') {
      prefill["Stream for Class 11th"] = prevStream;
      prefill["Stream"] = prevStream;
    }
    if (prevRoll) prefill["Exam Roll Number of Class 10th"] = prevRoll;
    if (prevSession) prefill["Year of Passing Class 10th"] = prevSession;
    if (prevMarks) prefill["Total Marks Obtained in Class 10th"] = prevMarks;
    prefill["Total Max. Marks in Class 10th"] = '500';
  } else if (suggestedClass === '10th' || prevClass === '9th') {
    prefill["Admission sought for class"] = '10th';
    prefill["Admission Type"] = 'Full';
    prefill["Board Registration No. (Class 9th)"] = rawReg;
    prefill["Name of Previous School (Class 9th)"] = "Govt Higher Secondary School Shangus";
    prefill["Board (Class 9th)"] = "JKBOSE";
  }

  Object.keys(prefill).forEach(k => {
    if (prefill[k] === undefined || prefill[k] === null || prefill[k] === '') delete prefill[k];
  });

  return {
    success: true,
    source,
    record: prefill,
    meta: {
      studentName,
      previousClass: prevClass || 'Unknown',
      previousSession: prevSession || 'Unknown',
      suggestedClass: suggestedClass || prevClass || '11th',
      stream: prevStream || 'Science',
    },
  };
}

function canClaimExisting(existing, token) {
  if (!existing) return true;
  if (existing.ownerUid === token.uid) return true;
  const recordEmail = String(existing.emailNormalized || existing['Email Address'] || existing.email || '').toLowerCase();
  return !existing.ownerUid && token.email_verified === true && recordEmail && recordEmail === String(token.email || '').toLowerCase();
}

async function saveDraft(db, token, body) {
  const sanitized = sanitizeValue(body.formData || {});
  let requestedId = cleanString(body.applicationId, 128);
  if (requestedId && !/^[a-zA-Z0-9_-]{1,128}$/.test(requestedId)) throw Object.assign(new Error('Invalid application ID.'), { status: 400 });
  ['Aadhar No.', "Father's Aadhar No.", 'Bank Account No.', 'Student Photo', 'photo_id', 'photo', 'photoUrl', 'photoPath'].forEach(key => delete sanitized[key]);

  const cls = normalizeClass(sanitized['Admission sought for class']);
  const session = normalizeSession(valueOf(sanitized, 'Session', 'session'));
  let inputFormNo = cleanString(valueOf(sanitized, 'Form Number', 'FormNo', 'formNo'), 20);

  // If requestedId is numeric (a form number rather than a Firestore doc ID), treat it as inputFormNo
  if (requestedId && /^\d{4,8}$/.test(requestedId)) {
    if (!inputFormNo) inputFormNo = requestedId;
    requestedId = '';
  }

  return db.runTransaction(async tx => {
    let existing = null;
    let targetRef = null;

    if (requestedId) {
      const snap = await tx.get(db.collection('admissions').doc(requestedId));
      if (snap.exists) {
        existing = snap;
        targetRef = snap.ref;
      }
    }

    // If requestedId did not exist or was empty, check if user has an existing application
    // with matching Form Number, or existing Rejected/Draft for this class/session
    if (!existing) {
      const email = String(token.email || '').toLowerCase();
      const queries = [tx.get(db.collection('admissions').where('ownerUid', '==', token.uid))];
      if (email && token.email_verified === true) {
        queries.push(tx.get(db.collection('admissions').where('emailNormalized', '==', email)));
        queries.push(tx.get(db.collection('admissions').where('Email Address', '==', email)));
      }
      const snaps = await Promise.all(queries);
      const candidateDocs = new Map();
      snaps.forEach(s => s.docs.forEach(d => candidateDocs.set(d.id, d)));
      const candidates = [...candidateDocs.values()].filter(d => {
        const dData = d.data();
        return !['Deleted', 'Purged', 'Withdrawn'].includes(dData.Status) && dData._deleted !== true;
      });

      // 1. Match by form number if present
      const targetFNo = inputFormNo || (body.formNumber ? String(body.formNumber).trim() : '');
      if (targetFNo) {
        const matchedByFNo = candidates.find(d => {
          const dData = d.data();
          const dFNo = cleanString(valueOf(dData, 'Form Number', 'FormNo', 'formNo'), 20);
          return dFNo === targetFNo;
        });
        if (matchedByFNo) {
          existing = matchedByFNo;
          targetRef = matchedByFNo.ref;
        }
      }

      // 2. Match by class and session (prioritizing Rejected over Draft)
      if (!existing && cls && session) {
        const matchingCls = candidates.filter(d => {
          const dData = d.data();
          const dCls = dData.classCanonical || normalizeClass(dData['Admission sought for class']);
          const dSession = dData.sessionCanonical || normalizeSession(valueOf(dData, 'Session', 'session'));
          return dCls === cls && dSession === session && ['Rejected', 'Draft'].includes(dData.Status);
        });
        matchingCls.sort((a, b) => {
          const rankA = a.data().Status === 'Rejected' ? 0 : 1;
          const rankB = b.data().Status === 'Rejected' ? 0 : 1;
          return rankA - rankB;
        });
        if (matchingCls.length > 0) {
          existing = matchingCls[0];
          targetRef = matchingCls[0].ref;
        }
      }
    }

    if (!targetRef) {
      targetRef = requestedId && !/^\d{4,8}$/.test(requestedId)
        ? db.collection('admissions').doc(requestedId)
        : db.collection('admissions').doc();
    }

    if (existing?.exists) {
      const prior = existing.data();
      if (!canClaimExisting(prior, token)) throw Object.assign(new Error('Application access denied.'), { status: 403 });
      if (!['Draft', 'Rejected'].includes(prior.Status)) throw Object.assign(new Error('This application is locked and cannot be changed.'), { status: 409 });
      if (prior.Status === 'Rejected' && prior.editableUntil?.toMillis?.() < Date.now()) throw Object.assign(new Error('The correction window has expired.'), { status: 409 });
    }

    const priorData = existing?.exists ? existing.data() : {};
    const isPriorRejected = priorData.Status === 'Rejected';
    const formNumber = cleanString(valueOf(priorData, 'Form Number', 'FormNo', 'formNo') || inputFormNo, 20);

    tx.set(targetRef, {
      ...sanitized,
      ownerUid: token.uid,
      emailNormalized: String(token.email || '').toLowerCase(),
      classCanonical: cls || null,
      sessionCanonical: session || null,
      ...(formNumber ? { 'Form Number': formNumber, FormNo: formNumber, formNo: formNumber } : {}),
      Status: isPriorRejected ? 'Rejected' : 'Draft',
      status: isPriorRejected ? 'Rejected' : 'Draft',
      ...(isPriorRejected ? {
        rejectionReason: priorData.rejectionReason || priorData['Rejection Reason'] || '',
        'Rejection Reason': priorData['Rejection Reason'] || priorData.rejectionReason || '',
        editableUntil: priorData.editableUntil || null,
        isEditable: true,
      } : {}),
      workflowVersion: 2,
      updatedAt: FieldValue.serverTimestamp(),
      ...(!existing?.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
    }, { merge: true });

    return {
      success: true,
      applicationId: targetRef.id,
      formNumber: formNumber || null,
      savedAt: new Date().toISOString()
    };
  });
}

async function submitApplication(db, token, body) {
  const sanitized = sanitizeValue(body.formData || {});
  // Spark-plan mode: store exactly one validated compressed image in
  // Firestore. HTTPS values remain accepted for a future Storage migration.
  const rawPhoto = body.photo || valueOf(body.formData || {}, 'photo_id', 'photoUrl', 'Student Photo');
  const photo = validatedPhoto(rawPhoto);
  if (rawPhoto && !photo) {
    throw Object.assign(new Error('The photograph is invalid or exceeds 100 KB.'), {
      status: 422,
      errors: { 'Student Photo': 'Upload a clear JPEG, PNG, or WebP photograph.' },
    });
  }
  ['Student Photo', 'photoId', 'photo', 'photoUrl', 'photoPath'].forEach(key => delete sanitized[key]);
  if (photo) sanitized.photo_id = photo;
  const normalized = validateSubmission(sanitized, token);
  const applicationId = cleanString(body.applicationId, 128);
  if (applicationId && !/^[a-zA-Z0-9_-]{1,128}$/.test(applicationId)) throw Object.assign(new Error('Invalid application ID.'), { status: 400 });
  const submissionKey = cleanString(body.submissionKey, 128);
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(submissionKey)) throw Object.assign(new Error('Invalid submission key.'), { status: 400 });

  let appRef = applicationId && !/^\d{4,8}$/.test(applicationId) ? db.collection('admissions').doc(applicationId) : null;
  const keyRef = db.collection('admissionSubmissionKeys').doc(`${token.uid}_${submissionKey}`);
  const counterRef = db.collection('systemSettings').doc('formNumberConfig');
  const settingsRef = db.collection('site').doc('settings');
  const registrationNo = registrationNumberFrom(sanitized);
  const photoBand = photoBandForClass(normalized.cls);
  const photoRef = registrationNo ? db.collection('studentPhotos').doc(`photo_${registrationNo}_${photoBand}`) : null;
  const recordIndexRef = registrationNo
    ? db.collection('studentApplicationIndex').doc(applicationIndexId(registrationNo, normalized.session, normalized.cls))
    : null;

  return db.runTransaction(async tx => {
    const legacyEmailQuery = db.collection('admissions').where('Email Address', '==', String(token.email || '').toLowerCase());
    const [keySnap, counterSnap, settingsSnap, ownedSnap, legacyEmailSnap, photoSnap, recordIndexSnap] = await Promise.all([
      tx.get(keyRef), tx.get(counterRef), tx.get(settingsRef),
      tx.get(db.collection('admissions').where('ownerUid', '==', token.uid)),
      tx.get(legacyEmailQuery),
      photoRef ? tx.get(photoRef) : Promise.resolve(null),
      recordIndexRef ? tx.get(recordIndexRef) : Promise.resolve(null),
    ]);
    if (keySnap.exists) return keySnap.data().result;
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    if (settings.globalAdmissionsClosed === true || settings.admissionsClosed?.[normalized.cls] === true) {
      throw Object.assign(new Error(`Admissions for Class ${normalized.cls} are currently closed.`), { status: 409 });
    }

    const candidateDocs = new Map();
    [...ownedSnap.docs, ...legacyEmailSnap.docs].forEach(doc => candidateDocs.set(doc.id, doc));

    let existingSnap = null;
    if (appRef) {
      existingSnap = await tx.get(appRef);
      if (!existingSnap.exists) existingSnap = null;
    }

    // Resolve true document reference if not found by direct ID
    if (!existingSnap) {
      const inputFNo = cleanString(valueOf(sanitized, 'Form Number', 'FormNo', 'formNo') || applicationId, 20);
      const matched = [...candidateDocs.values()].find(d => {
        const dData = d.data();
        const dFNo = cleanString(valueOf(dData, 'Form Number', 'FormNo', 'formNo'), 20);
        if (inputFNo && dFNo === inputFNo && !['Withdrawn', 'Purged', 'Deleted'].includes(dData.Status)) return true;
        const dCls = dData.classCanonical || normalizeClass(valueOf(dData, 'Admission sought for class', 'class'));
        const dSession = dData.sessionCanonical || normalizeSession(valueOf(dData, 'Session', 'session'));
        return dCls === normalized.cls && dSession === normalized.session && ['Rejected', 'Draft'].includes(dData.Status);
      });
      if (matched) {
        appRef = matched.ref;
        existingSnap = matched;
      } else {
        if (!appRef) appRef = db.collection('admissions').doc();
        existingSnap = await tx.get(appRef);
      }
    }

    let existing = existingSnap?.exists ? existingSnap.data() : null;
    if (existing && !canClaimExisting(existing, token)) throw Object.assign(new Error('Application access denied.'), { status: 403 });
    const upgradeMode = body.upgradeMode === true;
    if (existing && !['Draft', 'Rejected'].includes(existing.Status) && !(upgradeMode && existing.isProvisional === true)) {
      throw Object.assign(new Error('This application is already locked or finalized.'), { status: 409 });
    }
    if (existing?.Status === 'Rejected' && existing.editableUntil?.toMillis?.() < Date.now()) {
      throw Object.assign(new Error('The correction window has expired.'), { status: 409 });
    }

    const duplicate = [...candidateDocs.values()].find(doc => {
      if (doc.id === appRef.id) return false;
      const item = doc.data();
      const itemSession = item.sessionCanonical || normalizeSession(valueOf(item, 'Session', 'session'));
      const itemClass = item.classCanonical || normalizeClass(valueOf(item, 'Admission sought for class', 'class'));
      return itemSession === normalized.session && itemClass === normalized.cls &&
        ['Submitted', 'Under Review', 'Approved'].includes(item.Status) &&
        !['Draft', 'Withdrawn', 'Purged', 'Deleted', 'Rejected'].includes(item.Status) &&
        item._deleted !== true &&
        item._purged !== true;
    });
    if (duplicate) throw Object.assign(new Error(`An active application already exists for Class ${normalized.cls} in ${normalized.session}.`), { status: 409 });

    // Validate registration index: allow resubmission if owner is the same or prior record was rejected/withdrawn
    if (recordIndexSnap?.exists && recordIndexSnap.data()?.applicationId !== appRef.id) {
      const idxData = recordIndexSnap.data() || {};
      const isSameOwner = idxData.ownerUid === token.uid;
      let isIndexedActive = ['Submitted', 'Under Review', 'Approved'].includes(idxData.status);
      if (isIndexedActive) {
        const indexedDocSnap = await tx.get(db.collection('admissions').doc(idxData.applicationId));
        if (indexedDocSnap.exists) {
          const idxDocData = indexedDocSnap.data();
          if (['Rejected', 'Withdrawn', 'Draft', 'Purged', 'Deleted'].includes(idxDocData.Status) || idxDocData._deleted === true) {
            isIndexedActive = false;
          }
        } else {
          isIndexedActive = false;
        }
      }
      if (isIndexedActive && !isSameOwner) {
        throw Object.assign(new Error(`An active application already exists for this registration number in Class ${normalized.cls}, ${normalized.session}.`), { status: 409 });
      }
    }

    // Duplicate Mobile Guard for Same Academic Session
    const mobileDigits = digits(valueOf(sanitized, 'Mobile No. (with working WhatsApp)', 'mobile', 'Mobile Number')).slice(-10);
    const parentMobileDigits = digits(valueOf(sanitized, "Parent's Mobile No. (must be working)", 'parentMobile', 'Parent Mobile')).slice(-10);
    let duplicateMobileField = 'Mobile No. (with working WhatsApp)';
    if (mobileDigits) {
      const mobileQuery = db.collection('admissions').where('sessionCanonical', '==', normalized.session);
      const mobileSnaps = await tx.get(mobileQuery);
      const dupMobileDoc = mobileSnaps.docs.find(d => {
        if (d.id === appRef.id) return false;
        const dData = d.data();
        if (dData.ownerUid === token.uid) return false;
        if (['Withdrawn', 'Purged', 'Deleted', 'Rejected'].includes(dData.Status) || dData._deleted === true || dData._purged === true) return false;
        const dMobile = digits(valueOf(dData, 'Mobile No. (with working WhatsApp)', 'mobile', 'Mobile Number')).slice(-10);
        const dParentMobile = digits(valueOf(dData, "Parent's Mobile No. (must be working)", 'parentMobile', 'Parent Mobile')).slice(-10);
        if (dMobile === mobileDigits || dParentMobile === mobileDigits) return true;
        if (parentMobileDigits && (dMobile === parentMobileDigits || dParentMobile === parentMobileDigits)) {
          duplicateMobileField = "Parent's Mobile No. (must be working)";
          return true;
        }
        return false;
      });
      if (dupMobileDoc) {
        throw Object.assign(new Error('This mobile number is already used by another application in this session. Contact the school office for assistance.'), {
          status: 409,
          errors: {
            [duplicateMobileField]: 'This number is already used in this session. Contact the school office.'
          }
        });
      }
    }

    const counter = counterSnap.exists ? counterSnap.data() : {};
    let formNumber = cleanString(valueOf(existing || {}, 'Form Number', 'FormNo', 'formNo') || valueOf(sanitized || {}, 'Form Number', 'FormNo', 'formNo'), 20);

    if (!/^\d{3,10}$/.test(formNumber)) {
      const activeSession = normalized.session || currentAcademicSession();
      const sessionStartYear = activeSession.split('-')[0]; // "2025" for 2025-26
      const sessionPrefix = sessionStartYear.slice(-2); // "25"
      const defaultStart = parseInt(`${sessionPrefix}0001`, 10); // 250001

      const currentCounterNum = Number(counter.nextFormNumber || counter.startingSeries || defaultStart);
      const validNum = isNaN(currentCounterNum) || currentCounterNum < defaultStart ? defaultStart : currentCounterNum;
      formNumber = String(validNum);
      tx.set(counterRef, { ...counter, nextFormNumber: validNum + 1, session: activeSession }, { merge: true });
    }

    // Clean up any phantom duplicate draft documents for this student
    [...candidateDocs.values()].forEach(cDoc => {
      if (cDoc.id !== appRef.id) {
        const cData = cDoc.data();
        const cFNo = cleanString(valueOf(cData, 'Form Number', 'FormNo', 'formNo'), 20);
        const isDupDraft = (cData.Status === 'Draft' || cData.status === 'Draft') &&
          (cDoc.id === formNumber || (cFNo && cFNo === formNumber) ||
           (cData.classCanonical === normalized.cls && cData.sessionCanonical === normalized.session));
        if (isDupDraft) {
          tx.delete(cDoc.ref);
        }
      }
    });

    const now = FieldValue.serverTimestamp();
    const result = { success: true, applicationId: appRef.id, formNumber, status: 'Submitted' };
    let resolvedPhotoRef = photoRef?.path || cleanString(existing?.photoRef, 256) || null;
    if (photoRef && photo) {
      const priorPhoto = photoSnap?.exists ? photoSnap.data() : null;
      const priorClass = normalizeClass(priorPhoto?.sourceClass || priorPhoto?.selectedClass);
      const replacePhoto = !priorPhoto?.photo_id ||
        photoSourcePriority(normalized.cls) < photoSourcePriority(priorClass || normalized.cls) ||
        priorClass === normalized.cls;
      if (replacePhoto) {
        tx.set(photoRef, {
          photo_id: photo,
          boardRegNo: registrationNo,
          regNo: registrationNo,
          sourceClass: normalized.cls,
          photoBand,
          selectedClass: normalized.cls,
          updatedAt: now,
        }, { merge: true });
      }
    }
    const isCurrentlyProvisional = sanitized['Admission Type'] === 'Provisional' || sanitized['Admission Type (Class 11th)'] === 'Provisional' || sanitized['Admission Type (Class 12th)'] === 'Provisional';
    const wasProvisional = existing?.isProvisional === true || existing?.wasProvisional === true || existing?.upgradedFromProvisional === true || (upgradeMode && !isCurrentlyProvisional);
    const isUpgraded = upgradeMode || existing?.upgradedFromProvisional === true || (wasProvisional && !isCurrentlyProvisional);

    tx.set(appRef, {
      ...sanitized,
      ownerUid: token.uid,
      emailNormalized: normalized.email,
      'Email Address': normalized.email,
      classCanonical: normalized.cls,
      sessionCanonical: normalized.session,
      registrationNoCanonical: registrationNo || null,
      photoRef: resolvedPhotoRef,
      photoBand: registrationNo ? photoBand : null,
      ...(photoRef ? { photo_id: FieldValue.delete() } : {}),
      'Form Number': formNumber,
      FormNo: formNumber,
      formNo: formNumber,
      Status: 'Submitted',
      status: 'Submitted',
      isEditable: false,
      editableUntil: null,
      editUnlocked: false,
      editUnlockedUntil: null,
      rejectionReason: '',
      'Rejection Reason': '',
      rejectedAt: null,
      isProvisional: isCurrentlyProvisional,
      wasProvisional: wasProvisional,
      upgradedFromProvisional: isUpgraded,
      upgradedAt: isUpgraded ? (existing?.upgradedAt || now) : null,
      workflowVersion: 2,
      submissionKey,
      submittedAt: now,
      updatedAt: now,
      ...(!existing ? { createdAt: now } : {}),
    }, { merge: true });
    tx.set(counterRef, {
      nextFormNumber: Math.max(Number(counter.nextFormNumber || 0), Number(formNumber) + 1),
      lastUpdated: now,
    }, { merge: true });
    if (recordIndexRef) {
      tx.set(recordIndexRef, {
        registrationNo,
        sessionCanonical: normalized.session,
        classCanonical: normalized.cls,
        applicationId: appRef.id,
        formNumber,
        status: 'Submitted',
        ownerUid: token.uid,
        photoRef: resolvedPhotoRef,
        photoBand,
        updatedAt: now,
        ...(!recordIndexSnap?.exists ? { createdAt: now } : {}),
      }, { merge: true });
    }
    tx.create(keyRef, {
      ownerUid: token.uid,
      applicationId: appRef.id,
      result,
      createdAt: now,
      expiresAt: Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });
    tx.create(db.collection('admissionAuditLogs').doc(), {
      ownerUid: token.uid, applicationId: appRef.id, formNumber,
      action: upgradeMode ? 'student_upgrade_submitted' : 'student_application_submitted',
      createdAt: now,
    });
    return result;
  });
}

async function withdrawApplication(db, token, body) {
  const applicationId = cleanString(body.applicationId, 128);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(applicationId)) throw Object.assign(new Error('Invalid application ID.'), { status: 400 });
  const ref = db.collection('admissions').doc(applicationId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || !canClaimExisting(snap.data(), token)) throw Object.assign(new Error('Application not found.'), { status: 404 });
    const prior = snap.data();
    if (!['Draft', 'Submitted', 'Rejected'].includes(prior.Status)) {
      throw Object.assign(new Error('This application can no longer be withdrawn online. Please contact the admission office.'), { status: 409 });
    }
    const now = FieldValue.serverTimestamp();
    tx.update(ref, { ownerUid: token.uid, Status: 'Withdrawn', status: 'Withdrawn', withdrawnAt: now, updatedAt: now });

    const regNo = registrationNumberFrom(prior);
    const session = normalizeSession(prior.Session || prior.session);
    const cls = normalizeClass(prior['Admission sought for class'] || prior.class);
    if (regNo && session && cls) {
      const idxRef = db.collection('studentApplicationIndex').doc(applicationIndexId(regNo, session, cls));
      tx.set(idxRef, { status: 'Withdrawn', updatedAt: now }, { merge: true });
    }

    tx.create(db.collection('admissionAuditLogs').doc(), {
      ownerUid: token.uid, applicationId, formNumber: prior['Form Number'] || null,
      action: 'student_application_withdrawn', createdAt: now,
    });
    return { success: true, applicationId, status: 'Withdrawn' };
  });
}

exports.handler = async function handler(event) {
  const origin = allowedOrigin(event);
  if (!origin) return response(403, { error: 'Request origin is not allowed.' });
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Firebase-AppCheck', Vary: 'Origin' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed.' }, origin);
  if (Buffer.byteLength(event.body || '', 'utf8') > 750000) return response(413, { error: 'Request is too large. Upload files separately.' }, origin);

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    } catch (_) {
      return response(400, { error: 'Invalid request. Please reload the form and try again.' }, origin);
    }
    const token = await authenticate(event);
    const action = cleanString(body.action, 20);
    if (!['load', 'draft', 'submit', 'withdraw', 'lookup_registration'].includes(action)) return response(400, { error: 'Invalid action.' }, origin);
    const db = getFirestore(getAdminApp());
    if (!(await consumeRateLimit(db, token.uid, action))) return response(429, { error: 'Too many admission requests. Please wait and try again.' }, origin);
    const result = action === 'load' ? await loadWorkspace(db, token)
      : action === 'draft' ? await saveDraft(db, token, body)
        : action === 'submit' ? await submitApplication(db, token, body)
          : action === 'lookup_registration' ? await lookupRegistrationRecord(db, token, body)
            : await withdrawApplication(db, token, body);
    return response(200, result, origin);
  } catch (error) {
    console.error('Admission workflow error:', error.message);
    const errorCode = String(error.code || '');
    if (errorCode === '8' || errorCode === 'resource-exhausted' || /RESOURCE_EXHAUSTED/.test(error.message || '')) {
      return response(503, {
        code: 'admission/quota-exhausted',
        error: 'The admission database has reached its usage limit. Keep this form open and try again after the administrator restores capacity. This operation has not been confirmed.',
      }, origin);
    }
    return response(error.status || (errorCode.startsWith('auth/') ? 401 : 500), {
      error: error.status && error.status < 500 || error.code === 'admission/invalid-server-credentials'
        ? error.message : 'Admission service is temporarily unavailable. Please try again later.',
      code: error.code === 'admission/invalid-server-credentials' ? error.code : undefined,
      fieldErrors: error.errors || undefined,
    }, origin);
  }
};
