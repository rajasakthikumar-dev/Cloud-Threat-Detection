/**
 * routes/userRoutes.js
 * ----------------------
 * GET    /api/users              — list all users (admin)
 * DELETE /api/users/:id          — delete a user (admin)
 * PATCH  /api/users/:id/role     — change user role (admin)
 * GET    /api/users/stats        — own stats (authenticated)
 * GET    /api/users/admin/stats  — platform stats (admin)
 *
 * Activity logs are served by routes/logRoutes.js at GET /api/logs.
 */

const router   = require('express').Router();
const { protect }            = require('../middleware/authMiddleware');
const { adminOnly }          = require('../middleware/roleMiddleware');
const {
  listUsers,
  deleteUser,
  updateRole,
  restrictUser,
  releaseRestriction,
  getUserStats,
  getAdminStats,
  getUserActivitySummary,
  getAdminSecuritySummary,
} = require('../controllers/userController');

// All user routes require a valid JWT
router.use(protect);

// Own stats — available to every authenticated user
router.get('/stats', getUserStats);

// Admin-only routes
router.get('/',                          adminOnly, listUsers);
router.get('/activity-summary',          adminOnly, getUserActivitySummary);
router.get('/admin/stats',               adminOnly, getAdminStats);
router.get('/admin/security-summary',    adminOnly, getAdminSecuritySummary);
router.delete('/:id',                    adminOnly, deleteUser);
router.patch('/:id/role',                adminOnly, updateRole);
router.patch('/:id/restrict',            adminOnly, restrictUser);
router.patch('/:id/release',             adminOnly, releaseRestriction);

module.exports = router;
