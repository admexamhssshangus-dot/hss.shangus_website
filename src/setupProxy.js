const fs = require('fs');
const path = require('path');
const express = require('express');

module.exports = function(app) {
  // Use Express body parser middleware
  app.use(express.json({ limit: '10mb' }));

  app.post('/api/save-config', (req, res) => {
    try {
      const { settings, noticesText, faculty } = req.body;
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

      res.status(200).json({ success: true, message: 'Configuration saved to files successfully!' });
    } catch (error) {
      console.error('Error saving local files via setupProxy:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
};
