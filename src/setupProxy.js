const fs = require('fs');
const path = require('path');
const express = require('express');

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
      res.status(500).json({ success: false, error: error.message });
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
      res.status(500).json({ success: false, error: error.message });
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
      res.status(500).json({ success: false, error: error.message });
    }
  });
};

