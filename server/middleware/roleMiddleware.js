/**
 * middleware/roleMiddleware.js
 * ----------------------------
 * Role-based access control (RBAC) middleware.
 *
 * Usage — restrict a route to one or more roles:
 *
 *   router.get('/admin/users',
 *     protect,
 *     requireRole('admin'),
 *     userController.getAllUsers
 *   );
 *
 *   router.get('/reports',
 *     protect,
 *     requireRole('admin', 'analyst'),
 *     reportController.getReports
 *   );
 *
 * Must always be used AFTER the `protect` middleware so that
 * req.user is already populated.
 */

/**
 * requireRole
 * -----------
 * Returns an Express middleware that allows the request only if
 * the authenticated user's role matches one of the allowed roles.
 *
 * @param {...string} roles — one or more permitted role strings
 */
function requireRole(...roles) {
  return (req, res, next) => {
    // protect() must run first — check req.user exists
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}.`,
      });
    }

    next();
  };
}

/**
 * adminOnly
 * ---------
 * Shorthand middleware that restricts a route to admins only.
 * Equivalent to requireRole('admin').
 */
const adminOnly = requireRole('admin');

module.exports = { requireRole, adminOnly };
