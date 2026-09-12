/**
 * controllers/authController.js
 * -------------------------------
 * Handles user registration, login, and profile retrieval.
 * User records are stored in Firebase Firestore (no SQL/MongoDB).
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { generateToken } = require('../middleware/authMiddleware');
const {
  saveUser,
  findUserByEmail,
  findUserById,
  logActivity,
} = require('../config/firebase');

const { getClientInfo, formatClientInfo } = require('../utils/deviceParser');

// ─────────────────────────────────────────────────────────────
// REGISTER
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────
async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    // SECURITY: Public registration always creates 'user' role.
    // Client-submitted 'role' field is ignored.
    // Admin accounts must be created manually in the database.
    const role = 'user';

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    // Check for duplicate email
    const existing = await findUserByEmail(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    // Hash password
    const salt         = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user document in Firestore
    const userId = uuidv4();
    await saveUser({
      id:           userId,
      name:         name.trim(),
      email:        email.toLowerCase().trim(),
      role,
      passwordHash,
    });

    // Log the registration event with device info
    const clientInfo = getClientInfo(req);
    await logActivity({
      userId,
      userEmail:  email.toLowerCase(),
      event_type: 'user_created',
      details:    `New user registered: ${name} (${role}) from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device:     clientInfo.device,
      os:         clientInfo.os,
      browser:    clientInfo.browser,
      user_agent: clientInfo.userAgent,
    });

    // Return token so the user can be immediately logged in from the frontend
    const token = generateToken({ id: userId, email, role });

    return res.status(201).json({
      message: 'Account created successfully.',
      user:    { id: userId, name, email: email.toLowerCase(), role },
      token,
    });
  } catch (err) {
    console.error('[authController.register]', err);
    return res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Look up user
    const user = await findUserByEmail(email.toLowerCase().trim());
    if (!user) {
      // Generic message to avoid user enumeration
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Verify password
    const clientInfo = getClientInfo(req);
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      await logActivity({
        userId:     user.id,
        userEmail:  user.email,
        event_type: 'login_failed',
        details:    `Incorrect password attempt from ${formatClientInfo(clientInfo)}`,
        ip_address: clientInfo.ip,
        device:     clientInfo.device,
        os:         clientInfo.os,
        browser:    clientInfo.browser,
        user_agent: clientInfo.userAgent,
      });
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Issue JWT
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    // Log successful login with device info
    await logActivity({
      userId:     user.id,
      userEmail:  user.email,
      event_type: 'login',
      details:    `User logged in from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device:     clientInfo.device,
      os:         clientInfo.os,
      browser:    clientInfo.browser,
      user_agent: clientInfo.userAgent,
    });

    return res.json({
      message: 'Login successful.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    console.error('[authController.login]', err);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
}

// ─────────────────────────────────────────────────────────────
// LOGOUT
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────
// Custom-auth note: JWTs are stateless — the server cannot
// invalidate a token server-side.  The client must discard it.
// This endpoint exists so we can record the logout event in
// Firestore activity_logs before the client clears its storage.
async function logout(req, res) {
  try {
    const clientInfo = getClientInfo(req);
    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'logout',
      details:    `User logged out (${req.user.role}) from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device:     clientInfo.device,
      os:         clientInfo.os,
      browser:    clientInfo.browser,
      user_agent: clientInfo.userAgent,
    });
    return res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[authController.logout]', err);
    // Still respond 200 — client must clear its token regardless
    return res.json({ message: 'Logged out.' });
  }
}

// ─────────────────────────────────────────────────────────────
// GET CURRENT USER
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────
async function getMe(req, res) {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Never send the password hash to the client
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser });
  } catch (err) {
    console.error('[authController.getMe]', err);
    return res.status(500).json({ message: 'Failed to retrieve user.' });
  }
}

module.exports = { register, login, logout, getMe };
