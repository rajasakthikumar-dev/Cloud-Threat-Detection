/**
 * routes/authRoutes.js
 * ---------------------
 * POST /api/auth/register          — create account
 * POST /api/auth/login             — sign in, receive JWT
 * POST /api/auth/logout            — record logout event (requires valid JWT)
 * GET  /api/auth/me                — get authenticated user profile
 * POST /api/auth/forgot-password   — request password reset OTP (public)
 * POST /api/auth/verify-otp        — verify OTP before password reset (public)
 * POST /api/auth/reset-password    — submit new password with OTP or token (public)
 *
 * RATE LIMITING STRATEGY:
 * - login/register/password operations use strict authLimiter (20 per 15 min)
 * - GET /auth/me uses sessionLimiter (50 per 15 min) to support 30-second polling
 */

const router = require('express').Router();
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  verifyOTP,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Import rate limiters from server.js via a helper function
// Since rate limiters are defined in server.js, we'll receive them as middleware
// For now, we'll apply them via route-specific imports

// ── Public endpoints with strict rate limiting ────────────────────────
// These consume the authLimiter quota (20 per 15 min)
// Applied in server.js: app.use('/api/auth', authLimiter, authRoutes)
router.post('/register',        register);
router.post('/login',           login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp',      verifyOTP);
router.post('/reset-password',  resetPassword);

// ── Authenticated endpoints ──────────────────────────────────
router.post('/logout', protect, logout);

// Note: GET /auth/me is mounted separately in server.js with sessionLimiter
// to allow 30-second polling without consuming authLimiter quota

module.exports = router;
