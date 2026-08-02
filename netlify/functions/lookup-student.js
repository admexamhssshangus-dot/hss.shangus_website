/**
 * Netlify Serverless Function: lookup-student
 *
 * Secure server-side proxy for GK Test registration student lookup.
 * Queries Firestore collections (masterRegisters → registerdata → admissions)
 * server-side using Firebase REST API, returning ONLY safe minimal fields.
 *
 * This prevents anonymous browser clients from bulk-reading full student records.
 *
 * Required Netlify env vars:
 *   FIREBASE_API_KEY          — Firebase Web API key (restricted, read-only)
 *   FIREBASE_PROJECT_ID       — e.g. hss-shangus-portal
 *   LOOKUP_RATE_WINDOW_MS     — (optional) window for rate limiting, default 60000
 *   LOOKUP_RATE_MAX           — (optional) max calls per IP per window, default 10
 */

const FIREBASE_REST = 'https://firestore.googleapis.com/v1';

// Simple in-memory rate limiter (resets on cold start)
const rateStore = new Map();

function checkRate(ip, maxCalls = 10, windowMs = 60000) {
  const now = Date.now();
  const entry = rateStore.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count++;
  rateStore.set(ip, entry);
  return entry.count <= maxCalls;
}

function normalize(val) {
  return String(val || '').trim().toLowerCase().replace(/\s+/g, '');
}

// Convert Google Drive URLs to working image URLs (avoids CORS issues)
function resolvePhotoUrl(raw) {
  if (!raw) return null;
  if (raw.includes('drive.google.com')) {
    const m = raw.match(/[-\w]{25,}/);
    if (m) {
      // Use thumbnail URL which works cross-origin without login
      return `https://lh3.googleusercontent.com/d/${m[0]}=w400`;
    }
  }
  if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
  return null;
}

// Fetch a Firestore collection via REST API
async function fetchCollection(projectId, apiKey, collectionId) {
  const url = `${FIREBASE_REST}/projects/${projectId}/databases/(default)/documents/${collectionId}?pageSize=500&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.documents || []);
}

// Parse a Firestore REST document value
function parseValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return v.integerValue;
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(parseValue);
  if (v.mapValue) return parseFields(v.mapValue.fields || {});
  if (v.nullValue !== undefined) return null;
  return null;
}

function parseFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields || {})) {
    obj[k] = parseValue(v);
  }
  return obj;
}

function getField(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
}

// Extract and match student from a parsed Firestore document
function extractMatch(docData, query, type, docId) {
  // masterRegisters: items is an array
  const items = docData.items || docData.data || docData.records || docData.students;
  const docSession = docData.Session || docData.session || '';
  const docClass = docData.class || docData.Class || '';

  const candidates = Array.isArray(items)
    ? items.map(st => ({ session: docSession, class: docClass, ...st }))
    : [docData];

  for (const st of candidates) {
    const regNorm = normalize(
      getField(st,
        'boardRegNo', 'Board Registration Number',
        'Board Registration No. (Class 10th)',
        'Board Registration No. (Class 11th)',
        'Board Reg. No.', 'regNo', 'Registration No.'
      )
    );
    const formNorm = normalize(
      getField(st, 'formNo', 'Form Number', 'Form No.', 'FormNo')
    );

    const matched = type === 'regNo' ? (regNorm && regNorm === query) : (formNorm && formNorm === query);
    if (!matched) continue;

    const rawPhoto = getField(st,
      'photoUrl', 'photo_id', 'Student Photo',
      'Student Photograph', 'Photo', 'photo', 'photoId'
    );
    const photoUrl = resolvePhotoUrl(rawPhoto);

    const rollNo = getField(st,
      'classRollNo', 'Class Roll No', 'Class Roll No.',
      'Class R.No.', 'Class R.No', 'Roll No.', 'Roll No',
      'rollNo', 'roll_no', 'classRoll'
    );

    // Return ONLY safe minimum fields — no Aadhaar, no phone, no email, no address
    return {
      name: getField(st,
        'studentName', "Student's Name",
        "Student's Name (as per school records)", 'Student Name', 'Name'
      ),
      fatherName: getField(st,
        'fatherName', "Father's Name",
        "Father's/Guardian's Name (as per school records)", 'Father Name'
      ),
      className: getField(st, 'class', 'Class', 'Current Class') || docClass,
      classRollNo: rollNo,
      session: getField(st, 'session', 'Session') || docSession || '2025-26',
      boardRegNo: getField(st,
        'boardRegNo', 'Board Registration Number',
        'Board Registration No. (Class 10th)',
        'Board Registration No. (Class 11th)',
        'Board Reg. No.', 'Registration No.', 'regNo'
      ),
      formNo: getField(st, 'formNo', 'Form Number', 'Form No.', 'FormNo'),
      photoUrl,
    };
  }
  return null;
}

exports.handler = async function (event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limiting by IP
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const maxCalls = parseInt(process.env.LOOKUP_RATE_MAX || '10', 10);
  const windowMs = parseInt(process.env.LOOKUP_RATE_WINDOW_MS || '60000', 10);
  if (!checkRate(ip, maxCalls, windowMs)) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: 'Too many requests. Please wait and try again.' })
    };
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { query: rawQuery, type } = body;
  const query = normalize(rawQuery || '');

  if (!query || query.length < 3) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Query too short' }) };
  }
  if (!['regNo', 'formNo'].includes(type)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid type' }) };
  }

  const apiKey = process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  // Search in priority order: masterRegisters → registerdata → admissions
  const collections = ['masterRegisters', 'registerdata', 'admissions'];
  let found = null;

  for (const col of collections) {
    if (found) break;
    try {
      const docs = await fetchCollection(projectId, apiKey, col);
      for (const doc of docs) {
        const docData = parseFields(doc.fields || {});
        const match = extractMatch(docData, query, type, doc.name);
        if (match) {
          found = match;
          break;
        }
      }
    } catch (err) {
      console.error(`Error fetching ${col}:`, err.message);
    }
  }

  if (!found) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: type === 'regNo'
        ? 'No record found for this Registration Number.'
        : 'No record found for this Form Number.'
      })
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
    body: JSON.stringify({ student: found })
  };
};
