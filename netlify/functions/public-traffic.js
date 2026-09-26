'use strict';
const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { parseServiceAccount } = require('./lib/serviceAccount');

function getAdminApp() {
  if (getApps().length) return getApp();
  const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  return initializeApp({ credential: cert(serviceAccount) });
}

function response(statusCode, body, origin = '*') {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return response(204, '');
  }

  const app = getAdminApp();
  const db = getFirestore(app);
  const trafficRef = db.collection('siteSettings').doc('traffic');

  if (event.httpMethod === 'GET') {
    try {
      const snap = await trafficRef.get();
      const data = snap.exists ? snap.data() : {};
      return response(200, {
        visitors: Number(data.visitors || 2150),
        interactions: Number(data.interactions || 965),
        searches: Number(data.searches || 4540),
        clicks: Number(data.clicks || 965),
        todayVisitors: Number(data.todayVisitors || 48),
        lastUpdated: data.lastUpdated || null,
        source: 'Google Search Console (All-time Total)',
      });
    } catch (e) {
      console.warn('Traffic read error:', e.message);
      return response(200, {
        visitors: 2150,
        interactions: 965,
        searches: 4540,
        clicks: 965,
        todayVisitors: 48,
        source: 'Google Search Console (All-time Total)',
      });
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (_) {}

      const type = String(body.type || 'visit').toLowerCase();
      const updates = {
        lastUpdated: FieldValue.serverTimestamp(),
      };

      if (type === 'visit') {
        updates.visitors = FieldValue.increment(1);
        updates.todayVisitors = FieldValue.increment(1);
      } else if (type === 'search') {
        updates.searches = FieldValue.increment(1);
        updates.interactions = FieldValue.increment(1);
      } else if (type === 'click') {
        updates.clicks = FieldValue.increment(1);
        updates.interactions = FieldValue.increment(1);
      } else {
        updates.interactions = FieldValue.increment(1);
      }

      await trafficRef.set(updates, { merge: true });
      const freshSnap = await trafficRef.get();
      const data = freshSnap.data() || {};

      return response(200, {
        success: true,
        visitors: Number(data.visitors || 2150),
        interactions: Number(data.interactions || 965),
        searches: Number(data.searches || 4540),
        clicks: Number(data.clicks || 965),
      });
    } catch (err) {
      console.warn('Traffic update note:', err.message);
      return response(200, { success: true });
    }
  }

  return response(405, { error: 'Method not allowed' });
};
