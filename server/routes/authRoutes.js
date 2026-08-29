/**
 * routes/authRoutes.js
 * ---------------------
 * POST /api/auth/register  — create account
 * POST /api/auth/login     — sign in, receive JWT
 * POST /api/auth/logout    — record logout event (requires valid JWT)
 * GET  /api/auth/me        — get authenticated user profile
 */

const router = require('express').Router();
const { register, login, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login',    login);
router.post('/logout',   protect, logout);
router.get('/me',        protect, getMe);

module.exports = router;
