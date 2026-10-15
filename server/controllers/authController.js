/**
 * controllers/authController.js
 * -------------------------------
 * Handles user registration, login, and profile retrieval.
 * User records are stored in Firebase Firestore (no SQL/MongoDB).
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');         // Node built-in — no install needed
const { v4: uuidv4 } = require('uuid');
const { generateToken } = require('../middleware/authMiddleware');
const {
  saveUser,
  findUserByEmail,
  findUserById,
  logActivity,
  updateUser,
  savePasswordResetToken,
  validateAndConsumeResetToken,
  saveOTP,
  validateOTP,
  deleteOTPsByEmail,
} = require('../config/firebase');

const { getClientInfo, formatClientInfo } = require('../utils/deviceParser');
const { sendPasswordResetEmail, sendOTPEmail } = require('../services/emailService');

// Rule-based authentication monitor — separate from LSTM ML detection.
const { checkBruteForce } = require('../utils/bruteForceMonitor');

// Token expiry: 15 minutes (kept for backward compatibility with token-based reset)
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

// OTP expiry: 5 minutes
const OTP_EXPIRY_MS = 5 * 60 * 1000;

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
      // Log the failed attempt
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

      // ── Authentication-rule brute-force check ──────────────
      // Fire-and-forget: runs after response is sent if possible, but we
      // await it here so admins see the threat record promptly.
      // This check is RULE-BASED — it does NOT call the LSTM ML service.
      // Threat source will be 'authentication_rule', not 'ml_auto'.
      // The check never crashes the login response (try/catch inside).
      checkBruteForce({
        userId:    user.id,
        userEmail: user.email,
        clientIp:  clientInfo.ip,
      }).catch(err => console.error('[authController] bruteForce check failed:', err.message));
      // ────────────────────────────────────────────────────────

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
// Returns the full user document including current restriction state.
// This endpoint is EXEMPT from the restriction block in authMiddleware
// so that the frontend restriction-poll can detect new restrictions
// and the RestrictedPage can display accurate information.
// ─────────────────────────────────────────────────────────────
async function getMe(req, res) {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Never send the password hash to the client
    const { passwordHash, ...safeUser } = user;

    // If the user is currently restricted, include restriction details in the
    // response so the frontend can immediately show the restricted page without
    // waiting for the next protected API call to 403.
    const now = Date.now();
    const isRestricted = safeUser.restricted === true;
    let restrictionExpired = false;

    if (isRestricted && safeUser.restrictionExpiry) {
      const expiryMs = new Date(safeUser.restrictionExpiry).getTime();
      if (!isNaN(expiryMs) && expiryMs <= now) {
        restrictionExpired = true;
      }
    }

    return res.json({
      user: {
        ...safeUser,
        // Normalise restriction state considering expiry
        restricted: isRestricted && !restrictionExpired,
      },
    });
  } catch (err) {
    console.error('[authController.getMe]', err);
    return res.status(500).json({ message: 'Failed to retrieve user.' });
  }
}

// ─────────────────────────────────────────────────────────────
// FORGOT PASSWORD (OTP-based)
// POST /api/auth/forgot-password
// Public endpoint — no JWT required.
//
// SECURITY: Always returns the same generic message regardless of
// whether the email exists, to prevent user-enumeration attacks.
// ─────────────────────────────────────────────────────────────
async function forgotPassword(req, res) {
  // Generic response sent in every case — success or not
  const GENERIC_MSG = 'If an account with this email exists, a verification code has been sent.';

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      // Still return 200 + generic message — don't reveal what's wrong
      return res.json({ message: GENERIC_MSG });
    }

    const normalised = email.toLowerCase().trim();
    const user = await findUserByEmail(normalised);

    // Whether user exists or not, we respond identically to the client.
    // Internal logic only runs when the user actually exists.
    if (user) {
      // Generate a cryptographically secure 6-digit OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      
      // Hash the OTP before storing
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

      // Store ONLY the hash — raw OTP never touches the database
      await saveOTP({
        otpHash,
        userId:    user.id,
        email:     user.email,
        expiresAt,
      });

      // Send the OTP via email
      try {
        await sendOTPEmail({
          toEmail: user.email,
          toName:  user.name || 'User',
          otp,     // Only included in email, never logged or stored unhashed
        });
      } catch (emailErr) {
        // Email failure is logged server-side but hidden from the client
        // so that email-delivery errors don't leak user existence
        console.error('[authController.forgotPassword] Email send failed:', emailErr.message);
        // Still return generic success — OTP was saved, user can retry
      }

      // Activity log (no OTP value in details)
      await logActivity({
        userId:     user.id,
        userEmail:  user.email,
        event_type: 'password_reset_otp_requested',
        details:    `Password reset OTP requested`,
        ip_address: req.ip || '',
      });
    }
    // else: unknown email — fall through and return the same generic message

    return res.json({ message: GENERIC_MSG });
  } catch (err) {
    console.error('[authController.forgotPassword]', err);
    // Return generic message even on internal error — don't expose details
    return res.json({ message: 'If an account with this email exists, a verification code has been sent.' });
  }
}

// ─────────────────────────────────────────────────────────────
// VERIFY OTP
// POST /api/auth/verify-otp
// Public endpoint — no JWT required.
// Body: { email, otp }
//
// Validates the OTP without resetting the password.
// Frontend can call this before showing the new password input
// to provide immediate feedback on OTP validity.
// ─────────────────────────────────────────────────────────────
async function verifyOTP(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and verification code are required.' });
    }

    if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'Invalid verification code format.' });
    }

    const normalised = email.toLowerCase().trim();
    
    // Hash the OTP to compare with stored hash
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    
    // Validate the OTP (this also increments attempt counter and marks as used if valid)
    const record = await validateOTP(normalised, otpHash);

    if (!record) {
      return res.status(400).json({
        message: 'Invalid or expired verification code. Please request a new one.',
      });
    }

    // Log the verification
    await logActivity({
      userId:     record.userId,
      userEmail:  record.email,
      event_type: 'password_reset_otp_verified',
      details:    `OTP verified successfully`,
      ip_address: req.ip || '',
    });

    return res.json({ 
      message: 'Verification code confirmed.',
      email: record.email,
    });
  } catch (err) {
    console.error('[authController.verifyOTP]', err);
    return res.status(500).json({ message: 'OTP verification failed. Please try again.' });
  }
}

// ─────────────────────────────────────────────────────────────
// RESET PASSWORD (OTP-based)
// POST /api/auth/reset-password
// Public endpoint — no JWT required.
// Body: { email, otp, newPassword }
//
// IMPORTANT: Password reset NEVER modifies restriction fields.
// A restricted account remains restricted after password change.
// ─────────────────────────────────────────────────────────────
async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword, token } = req.body;

    // Support both OTP-based (new) and token-based (legacy) reset
    // Token-based kept for backward compatibility
    if (token) {
      return resetPasswordWithToken(req, res);
    }

    // OTP-based reset (new flow)
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required.' });
    }

    if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'Invalid verification code format.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const normalised = email.toLowerCase().trim();
    
    // Hash the OTP to compare with stored hash
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    
    // Validate the OTP
    const record = await validateOTP(normalised, otpHash);

    if (!record) {
      return res.status(400).json({
        message: 'Invalid or expired verification code. Please request a new one.',
      });
    }

    // Hash the new password with the same cost factor as registration
    const salt         = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update ONLY the password — never touch restriction fields
    await updateUser(record.userId, { passwordHash });

    // Delete all OTPs for this email to prevent reuse
    await deleteOTPsByEmail(normalised);

    // Activity log
    await logActivity({
      userId:     record.userId,
      userEmail:  record.email,
      event_type: 'password_reset_completed',
      details:    `Password successfully reset via OTP`,
      ip_address: req.ip || '',
    });

    return res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    console.error('[authController.resetPassword]', err);
    return res.status(500).json({ message: 'Password reset failed. Please try again.' });
  }
}

// ─────────────────────────────────────────────────────────────
// RESET PASSWORD WITH TOKEN (Legacy - kept for backward compatibility)
// ─────────────────────────────────────────────────────────────
async function resetPasswordWithToken(req, res) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }

    if (typeof token !== 'string' || token.length < 10) {
      return res.status(400).json({ message: 'Invalid or malformed reset token.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    // Hash the incoming raw token and look it up
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record    = await validateAndConsumeResetToken(tokenHash);

    if (!record) {
      // Covers: not found, already used, expired
      return res.status(400).json({
        message: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    // Hash the new password with the same cost factor as registration
    const salt         = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update ONLY the password — never touch restriction fields.
    await updateUser(record.userId, { passwordHash });

    // Activity log
    await logActivity({
      userId:     record.userId,
      userEmail:  record.email,
      event_type: 'password_reset_completed',
      details:    `Password successfully reset via email link`,
      ip_address: req.ip || '',
    });

    return res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    console.error('[authController.resetPasswordWithToken]', err);
    return res.status(500).json({ message: 'Password reset failed. Please try again.' });
  }
}

module.exports = { register, login, logout, getMe, forgotPassword, verifyOTP, resetPassword };
