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
  const defaults = [process.env.URL, process.env.DEPLOY_PRIME_URL, 'https://hssshangus.netlify.app']
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
  if (process.env.REQUIRE_APP_CHECK !== 'false') {
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
  const windowMs = action === 'load' ? 60000 : 300000;
  const max = action === 'load' ? 30 : action === 'draft' ? 20 : 6;
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
  if (email) {
    queries.push(db.collection('admissions').where('emailNormalized', '==', email).get());
    queries.push(db.collection('admissions').where('Email Address', '==', email).get());
  }
  const snapshots = await Promise.all(queries);
  const unique = new Map();
  snapshots.forEach(snap => snap.docs.forEach(doc => {
    const item = doc.data();
    const itemEmail = String(item.emailNormalized || item['Email Address'] || item.email || '').toLowerCase();
    if (item.ownerUid === token.uid || (!item.ownerUid && email && itemEmail === email)) unique.set(doc.id, { docId: doc.id, ...item });
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

function canClaimExisting(existing, token) {
  if (!existing) return true;
  if (existing.ownerUid === token.uid) return true;
  const recordEmail = String(existing.emailNormalized || existing['Email Address'] || existing.email || '').toLowerCase();
  return !existing.ownerUid && token.email_verified === true && recordEmail && recordEmail === String(token.email || '').toLowerCase();
}

async function saveDraft(db, token, body) {
  const sanitized = sanitizeValue(body.formData || {});
  const requestedId = cleanString(body.applicationId, 128);
  if (requestedId && !/^[a-zA-Z0-9_-]{1,128}$/.test(requestedId)) throw Object.assign(new Error('Invalid application ID.'), { status: 400 });
  ['Aadhar No.', "Father's Aadhar No.", 'Bank Account No.', 'Student Photo', 'photo_id', 'photo', 'photoUrl', 'photoPath'].forEach(key => delete sanitized[key]);
  const ref = requestedId ? db.collection('admissions').doc(requestedId) : db.collection('admissions').doc();
  await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      const prior = existing.data();
      if (!canClaimExisting(prior, token)) throw Object.assign(new Error('Application access denied.'), { status: 403 });
      if (!['Draft', 'Rejected'].includes(prior.Status)) throw Object.assign(new Error('This application is locked and cannot be changed.'), { status: 409 });
      if (prior.Status === 'Rejected' && prior.editableUntil?.toMillis?.() < Date.now()) throw Object.assign(new Error('The correction window has expired.'), { status: 409 });
    }
    const cls = normalizeClass(sanitized['Admission sought for class']);
    const session = normalizeSession(valueOf(sanitized, 'Session', 'session'));
    tx.set(ref, {
      ...sanitized,
      ownerUid: token.uid,
      emailNormalized: String(token.email || '').toLowerCase(),
      classCanonical: cls || null,
      sessionCanonical: session || null,
      Status: existing.exists && existing.data().Status === 'Rejected' ? 'Rejected' : 'Draft',
      workflowVersion: 2,
      updatedAt: FieldValue.serverTimestamp(),
      ...(!existing.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
    }, { merge: true });
  });
  return { success: true, applicationId: ref.id, savedAt: new Date().toISOString() };
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

  const appRef = applicationId ? db.collection('admissions').doc(applicationId) : db.collection('admissions').doc();
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
    const [keySnap, existingSnap, counterSnap, settingsSnap, ownedSnap, legacyEmailSnap, photoSnap, recordIndexSnap] = await Promise.all([
      tx.get(keyRef), tx.get(appRef), tx.get(counterRef), tx.get(settingsRef),
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

    let existing = existingSnap.exists ? existingSnap.data() : null;
    if (existing && !canClaimExisting(existing, token)) throw Object.assign(new Error('Application access denied.'), { status: 403 });
    const upgradeMode = body.upgradeMode === true;
    if (existing && !['Draft', 'Rejected'].includes(existing.Status) && !(upgradeMode && existing.isProvisional === true)) {
      throw Object.assign(new Error('This application is already locked or finalized.'), { status: 409 });
    }
    if (existing?.Status === 'Rejected' && existing.editableUntil?.toMillis?.() < Date.now()) {
      throw Object.assign(new Error('The correction window has expired.'), { status: 409 });
    }

    const candidateDocs = new Map();
    [...ownedSnap.docs, ...legacyEmailSnap.docs].forEach(doc => candidateDocs.set(doc.id, doc));
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
    if (recordIndexSnap?.exists && recordIndexSnap.data()?.applicationId !== appRef.id &&
      ['Submitted', 'Under Review', 'Approved'].includes(recordIndexSnap.data()?.status)) {
      throw Object.assign(new Error(`An active application already exists for this registration number in Class ${normalized.cls}, ${normalized.session}.`), { status: 409 });
    }

    // Duplicate Mobile Guard for Same Academic Session
    const mobileDigits = digits(valueOf(sanitized, 'Mobile No. (with working WhatsApp)', 'mobile', 'Mobile Number')).slice(-10);
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
        return dMobile === mobileDigits || dParentMobile === mobileDigits;
      });
      if (dupMobileDoc) {
        const dupData = dupMobileDoc.data();
        const fNo = dupData['Form Number'] || dupData.FormNo || dupData.formNo || dupMobileDoc.id;
        const cName = dupData.classCanonical || normalizeClass(valueOf(dupData, 'Admission sought for class', 'class')) || 'N/A';
        const sName = dupData.sessionCanonical || normalizeSession(valueOf(dupData, 'Session', 'session')) || normalized.session;
        throw Object.assign(new Error(`This mobile number is already linked to Form No. ${fNo} of Session ${sName} (Class ${cName}). Duplicate mobile submissions are not allowed for the same session.`), {
          status: 409,
          errors: {
            'Mobile No. (with working WhatsApp)': `This mobile number is already linked to Form No. ${fNo} of Session ${sName} (Class ${cName}).`
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
    tx.update(ref, { ownerUid: token.uid, Status: 'Withdrawn', withdrawnAt: now, updatedAt: now });
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
    if (!['load', 'draft', 'submit', 'withdraw'].includes(action)) return response(400, { error: 'Invalid action.' }, origin);
    const db = getFirestore(getAdminApp());
    if (!(await consumeRateLimit(db, token.uid, action))) return response(429, { error: 'Too many admission requests. Please wait and try again.' }, origin);
    const result = action === 'load' ? await loadWorkspace(db, token)
      : action === 'draft' ? await saveDraft(db, token, body)
        : action === 'submit' ? await submitApplication(db, token, body)
          : await withdrawApplication(db, token, body);
    return response(200, result, origin);
  } catch (error) {
    console.error('Admission workflow error:', error.message);
    return response(error.status || (error.code?.startsWith('auth/') ? 401 : 500), {
      error: error.status && error.status < 500 || error.code === 'admission/invalid-server-credentials'
        ? error.message : 'Admission service is temporarily unavailable. Please try again later.',
      code: error.code === 'admission/invalid-server-credentials' ? error.code : undefined,
      fieldErrors: error.errors || undefined,
    }, origin);
  }
};
