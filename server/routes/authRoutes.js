/**
 * routes/authRoutes.js
 * ---------------------
 * POST /api/auth/register          — create account
 * POST /api/auth/login             — sign in, receive JWT
 * POST /api/auth/logout            — record logout event (requires valid JWT)
 * GET  /api/auth/me                — get authenticated user profile
 * POST /api/auth/forgot-password   — request password reset email  (public)
 * POST /api/auth/reset-password    — submit new password with token (public)
 */

const router = require('express').Router();
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// ── Public endpoints (no JWT needed) ────────────────────────
router.post('/register',        register);
router.post('/login',           login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

// ── Authenticated endpoints ──────────────────────────────────
router.post('/logout', protect, logout);
router.get('/me',      protect, getMe);

module.exports = router;
