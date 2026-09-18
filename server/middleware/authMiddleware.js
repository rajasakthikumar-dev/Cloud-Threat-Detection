/**
 * middleware/authMiddleware.js
 * -----------------------------
 * Verifies the JWT Bearer token on every protected request.
 *
 * On success  : attaches req.user = { id, email, role } and calls next()
 * On 401      : invalid / missing / expired token
 * On 403      : account is currently restricted
 *
 * RESTRICTION ENFORCEMENT
 * -----------------------
 * JWTs are stateless — a valid token stays valid until it expires.
 * Simply setting restricted=true in Firestore does NOT block an
 * already-logged-in user whose token is still valid.
 *
 * Fix: after verifying the JWT signature we make ONE Firestore read
 * to check the user's current restriction state.  Because Firestore
 * caches document reads aggressively this adds negligible latency.
 *
 * Restriction check is SKIPPED for:
 *   - Admin users      (admins are never restricted)
 *   - POST /api/auth/logout  (user must be able to log out)
 *   - GET  /api/auth/me      (frontend needs this to show restricted banner)
 *
 * Expired restrictions are handled inline: if restrictionExpiry has
 * passed, we clear the flag in Firestore and allow the request through.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';

// Lazy-require firebase to avoid circular-dependency issues at module load.
// The actual connection is established the first time protect() is called.
function getFirebase() {
  return require('../config/firebase');
}

// Routes that restricted users are still allowed to call.
// Matched against req.method + req.path (after mount prefix is stripped).
const RESTRICTION_EXEMPT_ROUTES = [
  'POST /auth/logout',
  'GET /auth/me',
];

function isExemptFromRestriction(req) {
  // Build a simple "METHOD /path-after-/api" string for matching.
  // req.path inside the router already has the prefix stripped by Express.
  // We normalise to handle both /api/auth/logout and /auth/logout.
  const rawPath = req.originalUrl.split('?')[0];           // strip query string
  const path    = rawPath.replace(/^\/api/, '');           // strip /api prefix
  const key     = `${req.method} ${path}`;

  return RESTRICTION_EXEMPT_ROUTES.some(exempt => key.startsWith(exempt));
}

/**
 * protect
 * -------
 * Must be placed before any route handler that requires authentication.
 * Reads the token from:  Authorization: Bearer <token>
 */
async function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }

  // Attach minimal user info from the JWT payload
  req.user = {
    id:    decoded.id,
    email: decoded.email,
    role:  decoded.role,
  };

  // ── RESTRICTION ENFORCEMENT ──────────────────────────────────
  // Admins are never subject to account restrictions.
  // Certain auth endpoints are exempt so a restricted user can still
  // log out and the frontend can still detect the restriction state.
  if (req.user.role !== 'admin' && !isExemptFromRestriction(req)) {
    try {
      const { findUserById, updateUser } = getFirebase();
      const dbUser = await findUserById(req.user.id);

      if (dbUser && dbUser.restricted === true) {
        const now = Date.now();

        // ── Check expiry ─────────────────────────────────────
        if (dbUser.restrictionExpiry) {
          const expiryMs = new Date(dbUser.restrictionExpiry).getTime();

          if (!isNaN(expiryMs) && expiryMs <= now) {
            // Restriction has expired — clear it in Firestore and allow through
            try {
              await updateUser(req.user.id, {
                restricted:        false,
                restrictedAt:      null,
                restrictionExpiry: null,
                restrictionReason: null,
                restrictionSource: null,
                restrictedBy:      null,
                mlRiskScore:       null,
                mlAttackType:      null,
                releasedAt:        new Date().toISOString(),
                releasedBy:        'system (expiry)',
              });
            } catch (clearErr) {
              // Log but don't block the request — expiry has genuinely passed
              console.warn('[authMiddleware] Failed to clear expired restriction:', clearErr.message);
            }
            // Allow the request through
            return next();
          }
        }

        // ── Still restricted — build a user-friendly message ─
        const source  = dbUser.restrictionSource || 'manual';
        const reason  = dbUser.restrictionReason || 'suspicious activity';
        const expiry  = dbUser.restrictionExpiry
          ? new Date(dbUser.restrictionExpiry).toLocaleString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : null;

        const messageForUser = source === 'ml_auto'
          ? 'Your account has been temporarily restricted because suspicious activity was detected by our security system.'
          : 'Your account is temporarily restricted. Please contact an administrator.';

        return res.status(403).json({
          code:              'ACCOUNT_RESTRICTED',
          message:           messageForUser,
          restrictionReason: reason,
          restrictionExpiry: expiry,
          restrictionSource: source,
        });
      }
    } catch (firestoreErr) {
      // If Firestore is unavailable, fail OPEN (don't block legitimate users
      // due to a database outage).  Log the error for investigation.
      console.error('[authMiddleware] Restriction check failed — failing open:', firestoreErr.message);
    }
  }
  // ────────────────────────────────────────────────────────────

  next();
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
