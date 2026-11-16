const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { PORT, UPLOAD_DIR } = require('./config');
const { connectDB, stopMongod } = require('./db');

const app = express();
// The public link goes through a tunnel (proxy): read the visitor's real IP from the proxy header
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '2mb' }));

// Simple protection against password / code guessing: max requests per IP in a time window
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, 60000).unref();
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
    if (++h.count > max) return res.status(429).json({ error: message });
    next();
  };
}
const authLimit = rateLimit({ windowMs: 10 * 60000, max: 40, message: 'Too many tries. Please wait a few minutes and try again.' });
for (const p of ['login', 'register', 'verify', 'resend']) app.use('/api/auth/' + p, authLimit);
app.use('/api', rateLimit({ windowMs: 60000, max: 300, message: 'Too many requests. Please slow down.' }));

app.use('/api', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api', require('./routes/misc'));
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));

// Uploaded files: only images and PDFs open in the browser; everything else is downloaded,
// so an uploaded web page or script can never run inside the site.
const INLINE_TYPES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf']);
app.use('/uploads', express.static(UPLOAD_DIR, {
  index: false,
  dotfiles: 'ignore',
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Disposition', INLINE_TYPES.has(path.extname(filePath).toLowerCase()) ? 'inline' : 'attachment');
  },
}));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));

// Error handler: always answer JSON with a clear message
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  if (err.code === 'LIMIT_FILE_SIZE') { status = 400; message = 'File is too big (max 15 MB)'; }
  else if (err.name === 'MulterError') { status = 400; message = err.message; }
  else if (err.name === 'ValidationError' || err.name === 'CastError') { status = 400; }
  else if (err.code === 11000) { status = 409; message = 'Already exists'; }
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

connectDB()
  .then(() => require('./utils/schools').ensureSchools())
  .then(() => {
    const { mailConfigured } = require('./utils/mailer');
    console.log(mailConfigured ? '[mail] Gmail sending is ON' : '[mail] Gmail is not set up yet (fill SMTP_USER and SMTP_PASS in .env). Codes are shown on screen for testing.');
    app.listen(PORT, () => console.log(`Madrasti is running on http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error('Could not connect to MongoDB:', e.message);
    process.exit(1);
  });

const shutdown = async () => {
  await stopMongod();
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
