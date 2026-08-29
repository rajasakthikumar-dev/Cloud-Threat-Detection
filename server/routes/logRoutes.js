/**
 * routes/logRoutes.js
 * --------------------
 * GET /api/logs  — fetch paginated activity logs (admin only)
 *
 * Mounted at /api/logs in server.js.
 * The handler root '/' resolves correctly to GET /api/logs.
 *
 * Previously this was attempted via app.use('/api/logs', userRoutes),
 * which caused the handler at router.get('/logs') inside userRoutes
 * to resolve to /api/logs/logs — a 404.  This dedicated router fixes
 * that by registering the handler at '/'.
 */

const router                = require('express').Router();
const { protect }           = require('../middleware/authMiddleware');
const { adminOnly }         = require('../middleware/roleMiddleware');
const { getActivityLogs }   = require('../controllers/userController');

// GET /api/logs
router.get('/', protect, adminOnly, getActivityLogs);

module.exports = router;
