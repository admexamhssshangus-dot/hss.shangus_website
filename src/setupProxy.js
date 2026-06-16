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

  app.post('/api/save-config', (req, res) => {
    try {
      // 1. Restrict requests strictly to loopback/localhost to prevent network-based abuse
      const remoteIp = req.ip || req.connection.remoteAddress || '';
      const isLocalhost = remoteIp === '127.0.0.1' || 
                          remoteIp === '::1' || 
                          remoteIp === '::ffff:127.0.0.1' || 
                          remoteIp.includes('localhost');

      // 2. Enforce Host header validation to prevent DNS Rebinding attacks
      const host = req.headers.host || '';
      const isValidHost = host.startsWith('localhost:') || 
                          host.startsWith('127.0.0.1:') || 
                          host.startsWith('[::1]:');

      if (!isLocalhost || !isValidHost) {
        return res.status(403).json({ 
          success: false, 
          error: 'Forbidden: Configuration saving is only allowed from local dev connections on localhost.' 
        });
      }

      const { settings, noticesText, faculty, admins } = req.body;
      // Resolve path to frontend/public/slides
      const slidesDir = path.join(__dirname, '..', 'public', 'slides');

      if (!fs.existsSync(slidesDir)) {
        fs.mkdirSync(slidesDir, { recursive: true });
      }

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

      res.status(200).json({ success: true, message: 'Configuration saved to files successfully!' });
    } catch (error) {
      console.error('Error saving local files via setupProxy:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
};

