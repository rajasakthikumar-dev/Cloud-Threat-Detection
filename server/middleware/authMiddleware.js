/**
 * middleware/authMiddleware.js
 * -----------------------------
 * Verifies the JWT Bearer token on every protected request.
 *
 * On success  : attaches req.user = { id, email, role } and calls next()
 * On failure  : responds 401 Unauthorized
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';

/**
 * protect
 * -------
 * Must be placed before any route handler that requires authentication.
 *
 * Reads the token from the Authorization header:
 *   Authorization: Bearer <token>
 */
function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  // Check header format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify signature and expiry
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach minimal user info to the request object
    req.user = {
      id:    decoded.id,
      email: decoded.email,
      role:  decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }
}

/**
 * generateToken
 * -------------
 * Creates a signed JWT for the given user payload.
 *
 * @param {{ id, email, role }} user
 * @param {string} [expiresIn] — default '7d'
 * @returns {string} signed JWT
 */
function generateToken(user, expiresIn = '7d') {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn }
  );
}

/**
 * requireAdmin
 * ------------
 * Middleware that enforces admin-only access.
 * Must be chained AFTER protect() middleware.
 *
 * Usage:
 *   router.get('/admin/users', protect, requireAdmin, getUserList);
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  next();
}

module.exports = { protect, generateToken, requireAdmin };
