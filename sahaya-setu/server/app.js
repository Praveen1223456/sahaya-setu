const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const env = require('./config/env');
const formatters = require('./views/formatters');
const citizenRoutes = require('./routes/citizenRoutes');
const staffRoutes = require('./routes/staffRoutes');
const publicRoutes = require('./routes/publicRoutes');
const authRoutes = require('./routes/authRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const workforceRoutes = require('./routes/workforceRoutes');
const disasterRoutes = require('./routes/disasterRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const { handleUploadError } = require('./middleware/upload');
const { WorkflowError } = require('./services/services');
const { BadImage } = require('./services/imaging');
const { CapError } = require('./services/alerts');

const app = express();

// Enable CORS
app.use(cors());

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
// Text/XML body parser for CAP import
app.use(express.text({ type: ['text/xml', 'application/xml', 'application/text'], limit: '20mb' }));

// Ensure upload directory exists
fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.join(env.UPLOAD_DIR, 'reports'), { recursive: true });
fs.mkdirSync(path.join(env.UPLOAD_DIR, 'resolutions'), { recursive: true });

// Static uploads
app.use('/uploads', express.static(env.UPLOAD_DIR));

// Prevent missing upload images from falling through to the React HTML SPA
app.use('/uploads', (req, res) => {
  const placeholder = path.join(env.STATIC_DIR, 'shared', 'placeholder-image.svg');
  if (fs.existsSync(placeholder)) {
    res.status(404).type('image/svg+xml').sendFile(placeholder);
  } else {
    res.status(404).json({ error: 'Image not found', path: req.path });
  }
});

// System health check
app.get('/health', (req, res) => {
  res.json({ ok: true, time: formatters.iso(new Date()) });
});

// Modern Smart Civic API Routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/workforce', workforceRoutes);
app.use('/api/disaster', disasterRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', voiceRoutes);

// Existing Legacy & Bridge Routes
app.use('/public', publicRoutes);
app.use('/', voiceRoutes);
app.use('/', citizenRoutes);
app.use('/', staffRoutes);

// Static assets (shared and vendor files for fonts, icons, Leaflet)
app.use('/shared', express.static(path.join(env.STATIC_DIR, 'shared')));
app.use('/vendor', express.static(path.join(env.STATIC_DIR, 'vendor')));

// Check if React build directory exists (client/dist or dist)
const clientDist = path.join(env.BASE_DIR, 'client', 'dist');
const rootDist = path.join(env.BASE_DIR, 'dist');
const reactDist = fs.existsSync(clientDist) ? clientDist : (fs.existsSync(rootDist) ? rootDist : null);

if (reactDist) {
  app.use(express.static(reactDist, { index: false }));
  // Serve React SPA for HTML requests
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) {
      res.sendFile(path.join(reactDist, 'index.html'));
    } else {
      next();
    }
  });
} else {
  // Fallback to static html files if React is not yet built
  for (const name of ['citizen', 'dashboard', 'field', 'board']) {
    app.use(`/${name}`, express.static(path.join(env.STATIC_DIR, name)));
  }
  app.get('/', (req, res) => {
    res.sendFile(path.join(env.STATIC_DIR, 'index.html'));
  });
}

// Multer error handling
app.use(handleUploadError);

// Global Error Handler
app.use((err, req, res, next) => {
  if (err instanceof WorkflowError) {
    return res.status(409).json({ detail: err.message });
  }
  if (err instanceof BadImage || err instanceof CapError) {
    return res.status(400).json({ detail: err.message });
  }
  if (err.status) {
    return res.status(err.status).json({ detail: err.message });
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ detail: err.message || 'Internal Server Error' });
});

module.exports = app;
