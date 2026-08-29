/**
 * routes/threatRoutes.js
 * ------------------------
 * POST /api/threats/analyze  — send features to ML service, get prediction
 * GET  /api/threats/stats    — aggregated threat statistics
 * GET  /api/threats/recent   — most recent threat records
 * GET  /api/threats          — list threat logs
 * GET  /api/threats/:id      — full detail + correlated activity (admin only)
 *
 * IMPORTANT: named sub-paths (/stats, /recent) must be registered BEFORE
 * the /:id wildcard so Express does not swallow them as IDs.
 */

const router = require('express').Router();
const { protect }   = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');
const {
  analyzeActivity,
  getThreats,
  getThreatStats,
  getRecentThreats,
  getThreatById,
} = require('../controllers/threatController');

// All threat routes require a valid JWT
router.use(protect);

router.post('/analyze', analyzeActivity);
router.get('/stats',    getThreatStats);
router.get('/recent',   getRecentThreats);
router.get('/',         getThreats);
router.get('/:id',      adminOnly, getThreatById);   // ← must be last

module.exports = router;
