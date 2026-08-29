/**
 * server.js
 * ----------
 * Entry point for the AI Threat Detection Express backend.
 *
 * Responsibilities:
 *   - Loads environment variables from .env
 *   - Applies global middleware (Helmet, CORS, rate-limiting, Morgan)
 *   - Mounts all API route groups
 *   - Initialises Socket.io for real-time threat broadcasting
 *   - Starts the HTTP server
 */

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

// ── Route imports ─────────────────────────────────────────────
const authRoutes   = require('./routes/authRoutes');
const fileRoutes   = require('./routes/fileRoutes');
const userRoutes   = require('./routes/userRoutes');
const threatRoutes = require('./routes/threatRoutes');
const logRoutes    = require('./routes/logRoutes');  // GET /api/logs

// ── Socket.io initialiser ─────────────────────────────────────
const initSocket = require('./socket/socket');

// ── Firebase initialisation (runs side-effects on import) ─────
require('./config/firebase');

// ─────────────────────────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// Attach Socket.io to the HTTP server and export the emitter
const { emitThreatAlert } = initSocket(server);

// Make the socket emitter available to controllers via app locals
app.set('emitThreatAlert', emitThreatAlert);

// ─────────────────────────────────────────────────────────────
// GLOBAL MIDDLEWARE
// ─────────────────────────────────────────────────────────────

// Security headers
app.use(helmet());

// CORS — allow React client origin
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logger (skip in test env)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('[:date[clf]] :method :url :status :response-time ms'));
}

// Global rate limiter — 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// Stricter limiter for auth endpoints — 20 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many auth attempts. Please wait before retrying.' },
});

// ─────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────
app.use('/api/auth',    authLimiter, authRoutes);
app.use('/api/files',   fileRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/threats', threatRoutes);
app.use('/api/logs',    logRoutes);

// ─────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'AI Threat Detection API',
    timestamp: new Date().toISOString(),
    uptime:    `${Math.floor(process.uptime())}s`,
  });
});

// ─────────────────────────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// ─────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  AI Threat Detection API`);
  console.log(`  Listening on http://localhost:${PORT}`);
  console.log(`  Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`${'='.repeat(50)}\n`);
});

module.exports = { app, server };
