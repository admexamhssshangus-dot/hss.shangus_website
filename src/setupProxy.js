const fs = require('fs');
const path = require('path');
const express = require('express');
const https = require('https');

// Explicitly load local server environment variables (.env.local & .env)
try {
  const dotenv = require('dotenv');
  if (fs.existsSync(path.resolve(__dirname, '../.env.local'))) {
    dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
  }
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
} catch (e) {}

// Ensure Netlify Functions dependencies (e.g. firebase-admin) are resolvable by local proxy
const netlifyModulesPath = path.resolve(__dirname, '../netlify/functions/node_modules');
if (fs.existsSync(netlifyModulesPath) && !module.paths.includes(netlifyModulesPath)) {
  module.paths.push(netlifyModulesPath);
}

module.exports = function(app) {
  // Inject basic security headers
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Use Express body parser middleware
  app.use(express.json({ limit: '10mb' }));

  const slidesDir = path.join(__dirname, '..', 'public', 'slides');

  // Shared localhost + host header guard
  function assertLocalhost(req, res) {
    // 1. Restrict requests strictly to loopback/localhost to prevent network-based abuse
    const remoteIp = req.ip || req.connection.remoteAddress || '';
    const isLocalhost = remoteIp === '127.0.0.1' ||
                        remoteIp === '::1' ||
                        remoteIp === '::ffff:127.0.0.1' ||
                        remoteIp.includes('localhost');

    // 2. Enforce Host header validation to prevent DNS Rebinding attacks
    const host = req.headers.host || '';
    const isValidHost = host === 'localhost' || host.startsWith('localhost:') ||
                        host === '127.0.0.1' || host.startsWith('127.0.0.1:') ||
                        host === '[::1]' || host.startsWith('[::1]:');

    if (!isLocalhost || !isValidHost) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: This endpoint is only allowed from local dev connections on localhost.'
      });
      return false;
    }
    return true;
  }

  // CRA does not execute Netlify Functions. In local development, invoke the
  // function locally when an unprefixed server credential is present; otherwise
  // securely relay to the deployed Netlify function. This keeps browser code
  // free of admin credentials and makes npm start exercise the real write path.
  app.post('/.netlify/functions/admission-workflow', async (req, res) => {
    if (!assertLocalhost(req, res)) return;

    try {
      const dotenv = require('dotenv');
      if (fs.existsSync(path.resolve(__dirname, '../.env.local'))) {
        dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
      }
      dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
    } catch (e) {}

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        try { delete require.cache[require.resolve('../netlify/functions/admission-workflow')]; } catch (e) {}
        const { handler } = require('../netlify/functions/admission-workflow');
        const reqOrigin = req.headers.origin || `http://${req.headers.host || 'localhost:3000'}`;
        const result = await handler({
          httpMethod: 'POST',
          headers: {
            authorization: req.headers.authorization || '',
            origin: reqOrigin,
            'x-firebase-appcheck': req.headers['x-firebase-appcheck'] || '',
          },
          body: JSON.stringify(req.body || {}),
        });
        Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
        return res.status(result.statusCode || 500).send(result.body || '');
      } catch (error) {
        console.warn('Local admission function failed, falling back to upstream relay:', error.message);
      }
    }

    const configuredUrl = process.env.ADMISSION_WORKFLOW_DEV_URL ||
      'https://hssshangus.netlify.app/.netlify/functions/admission-workflow';
    let target;
    try {
      target = new URL(configuredUrl);
      if (target.protocol !== 'https:' || target.pathname !== '/.netlify/functions/admission-workflow') throw new Error('Invalid target');
    } catch {
      return res.status(503).json({ error: 'ADMISSION_WORKFLOW_DEV_URL is not configured correctly.' });
    }

    const body = JSON.stringify(req.body || {});
    const upstream = https.request({
      hostname: target.hostname,
      port: 443,
      path: target.pathname,
      method: 'POST',
      timeout: 20000,
      headers: {
        Authorization: req.headers.authorization || '',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Origin: 'http://localhost:3000',
        ...(req.headers['x-firebase-appcheck'] ? { 'X-Firebase-AppCheck': req.headers['x-firebase-appcheck'] } : {}),
      },
    }, upstreamResponse => {
      let responseBody = '';
      upstreamResponse.setEncoding('utf8');
      upstreamResponse.on('data', chunk => {
        if (responseBody.length < 1024 * 1024) responseBody += chunk;
      });
      upstreamResponse.on('end', () => {
        res.setHeader('Cache-Control', 'no-store');
        res.type('application/json').status(upstreamResponse.statusCode || 502).send(responseBody || '{}');
      });
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Admission service timed out')));
    upstream.on('error', error => {
      console.error('Admission development relay error:', error.message);
      if (!res.headersSent) res.status(502).json({ error: 'The deployed admission service is unavailable.' });
    });
    upstream.end(body);
  });

  // Ensure slidesDir exists
  function ensureSlidesDir() {
    if (!fs.existsSync(slidesDir)) {
      fs.mkdirSync(slidesDir, { recursive: true });
    }
  }

  app.post('/api/save-config', (req, res) => {
    try {
      if (!assertLocalhost(req, res)) return;

      const { settings, noticesText, faculty, admins, slidesText } = req.body;

      ensureSlidesDir();

      if (settings) {
        fs.writeFileSync(
          path.join(slidesDir, 'settings.json'),
          JSON.stringify(settings, null, 2),
          'utf8'
        );
      }

      if (noticesText !== undefined) {
        fs.writeFileSync(
          path.join(slidesDir, 'notices.txt'),
          noticesText,
          'utf8'
        );
      }

      if (faculty) {
        const cleanedFaculty = faculty.map(({ id, ...rest }) => rest);
        fs.writeFileSync(
          path.join(slidesDir, 'faculty.json'),
          JSON.stringify(cleanedFaculty, null, 2),
          'utf8'
        );
      }

      if (admins) {
        fs.writeFileSync(
          path.join(slidesDir, 'admins.json'),
          JSON.stringify(admins, null, 2),
          'utf8'
        );
      }

      if (slidesText !== undefined) {
        fs.writeFileSync(
          path.join(slidesDir, 'slides.txt'),
          slidesText,
          'utf8'
        );
      }

      res.status(200).json({ success: true, message: 'Configuration saved to files successfully!' });
    } catch (error) {
      console.error('Error saving local files via setupProxy:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // Admin messages storage (local dev)
  // AdminMessages.jsx calls GET /api/messages.
  // Contact form (not shown here) may POST /api/messages; we support both.
  app.get('/api/messages', (req, res) => {
    try {
      if (!assertLocalhost(req, res)) return;

      ensureSlidesDir();

      const filePath = path.join(slidesDir, 'messages.json');
      if (!fs.existsSync(filePath)) {
        return res.status(200).json([]);
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw || '[]');
      return res.status(200).json(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error('Error reading messages via setupProxy:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  app.post('/api/messages', (req, res) => {
    try {
      if (!assertLocalhost(req, res)) return;

      ensureSlidesDir();

      const filePath = path.join(slidesDir, 'messages.json');

      const { message } = req.body || {};
      // Accept either { message } or direct message fields payload
      const incoming = message || req.body || {};

      const record = {
        subject: incoming.subject || incoming.title || '',
        name: incoming.name || '',
        phone: incoming.phone || incoming.mobile || '',
        email: incoming.email || '',
        message: incoming.message || incoming.body || '',
        createdAt: incoming.createdAt || Date.now()
      };

      const existingRaw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '[]';
      let existing = [];
      try {
        existing = JSON.parse(existingRaw || '[]');
      } catch {
        existing = [];
      }
      if (!Array.isArray(existing)) existing = [];

      existing.push(record);

      fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf8');

      res.status(200).json({ success: true, message: 'Message stored locally.' });
    } catch (error) {
      console.error('Error saving messages via setupProxy:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
};
