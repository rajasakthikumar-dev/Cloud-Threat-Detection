/**
 * controllers/threatController.js
 * ----------------------------------
 * Proxies network activity data to the Python ML service,
 * saves threat results to Firebase, and broadcasts alerts via Socket.io.
 */

const axios = require('axios');
const { logThreat, logActivity, db, COLLECTIONS } = require('../config/firebase');
const { getClientIp } = require('../utils/ipExtractor');
const { ML_AUTO } = require('../config/securityRules');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// ─────────────────────────────────────────────────────────────
// ANALYZE ACTIVITY  (proxy to Python ML service)
// POST /api/threats/analyze
// Body: { features: { ... } }  — network activity feature object
// ─────────────────────────────────────────────────────────────
async function analyzeActivity(req, res) {
  try {
    const { features, source_ip } = req.body;

    if (!features || typeof features !== 'object') {
      return res.status(400).json({ message: 'Request body must include a "features" object.' });
    }

    // Forward to FastAPI ML service
    let mlResult;
    try {
      const mlRes = await axios.post(`${ML_SERVICE_URL}/predict`, { features }, { timeout: 15000 });
      mlResult = mlRes.data;
    } catch (mlErr) {
      console.error('[threatController] ML service error:', mlErr.message);
      return res.status(502).json({
        message: 'ML service unavailable. Please ensure the Python service is running.',
        ml_service_url: ML_SERVICE_URL,
      });
    }

    const { attack_type, risk_level, confidence_score } = mlResult;

    // Extract real client IP
    const clientIp = getClientIp(req);
    const sourceIp = source_ip || clientIp;

    // Persist to Firebase
    const threatId = await logThreat({
      userId:          req.user.id,
      userEmail:       req.user.email,
      attack_type,
      risk_level,
      confidence_score,
      source_ip:       sourceIp,
      raw_input:       features,
    });

    // Log as activity
    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'threat_detected',
      details:    `${attack_type} detected — Risk: ${risk_level} (${confidence_score}%)`,
      ip_address: clientIp,
    });

    // ── MODULE 1: AUTO-RESTRICTION on HIGH risk ───────────────
    // When the ML model returns HIGH risk, automatically apply a
    // temporary restriction to the user's account.
    // Source = 'ml_auto' — honest label, this IS the LSTM result.
    // Does NOT block admins, does NOT duplicate an existing active restriction.
    if (risk_level === 'High') {
      try {
        const { findUserById, updateUser } = require('../config/firebase');
        const targetUser = await findUserById(req.user.id);

        // Only auto-restrict regular users; never restrict admins
        if (targetUser && targetUser.role !== 'admin') {
          const now = new Date();
          let alreadyRestricted = targetUser.restricted === true;

          // Check if existing restriction has already expired
          if (alreadyRestricted && targetUser.restrictionExpiry) {
            const expiry = new Date(targetUser.restrictionExpiry);
            if (!isNaN(expiry.getTime()) && expiry <= now) {
              alreadyRestricted = false;  // expired — can apply fresh restriction
            }
          }

          if (!alreadyRestricted) {
            const expiryMinutes = ML_AUTO.RESTRICTION_MINUTES;
            const expiryDate = new Date(now.getTime() + expiryMinutes * 60 * 1000);
            const reason = `ML Detection: ${attack_type} detected at ${confidence_score}% confidence`;

            await updateUser(req.user.id, {
              restricted:          true,
              restrictedAt:        now.toISOString(),
              restrictionExpiry:   expiryDate.toISOString(),
              restrictionReason:   reason,
              restrictionSource:   'ml_auto',           // honest — LSTM detected this
              restrictedBy:        'system (ML)',
              mlRiskScore:         confidence_score,
              mlAttackType:        attack_type,
              releasedAt:          null,
            });

            await logActivity({
              userId:     req.user.id,
              userEmail:  req.user.email,
              event_type: 'user_restricted',
              details:    `[ML AUTO] ${reason} — account restricted for ${expiryMinutes} minutes`,
              ip_address: clientIp,
            });

            console.log(`[threatController] ML AUTO-RESTRICTION applied to user ${req.user.email} — ${reason}`);
          } else {
            console.log(`[threatController] HIGH risk for ${req.user.email} but restriction already active — skipping duplicate`);
          }
        }
      } catch (restrictErr) {
        // Auto-restriction failure must never break the ML response
        console.error('[threatController] Auto-restriction error:', restrictErr.message);
      }
    }
    // ─────────────────────────────────────────────────────────

    // Broadcast real-time alert via Socket.io to all connected clients
    const emitThreatAlert = req.app.get('emitThreatAlert');
    if (emitThreatAlert) {
      emitThreatAlert({
        threatId,
        attack_type,
        risk_level,
        confidence_score,
        source_ip: sourceIp,
        timestamp: new Date().toISOString(),
        userId: req.user.id,
      });
    }

    return res.json({
      threatId,
      attack_type,
      risk_level,
      confidence_score,
      message: `Analysis complete — ${risk_level} risk detected.`,
    });
  } catch (err) {
    console.error('[threatController.analyzeActivity]', err);
    return res.status(500).json({ message: 'Threat analysis failed.' });
  }
}

// ─────────────────────────────────────────────────────────────
// LIST THREATS
// GET /api/threats
// Query params: limit, risk_level, userId (admin only)
// ─────────────────────────────────────────────────────────────
async function getThreats(req, res) {
  try {
    const limit     = Math.min(parseInt(req.query.limit) || 100, 500);
    const riskLevel = req.query.risk_level;

    let query = db.collection(COLLECTIONS.THREAT_LOGS)
      .orderBy('timestamp', 'desc');

    // Scope to own threats for non-admins
    if (req.user.role !== 'admin') {
      query = query.where('userId', '==', req.user.id);
    }

    if (riskLevel && ['Low', 'Medium', 'High'].includes(riskLevel)) {
      query = query.where('risk_level', '==', riskLevel);
    }

    const snap    = await query.limit(limit).get();
    const threats = snap.docs.map(doc => ({
      id:               doc.id,
      attack_type:      doc.data().attack_type,
      risk_level:       doc.data().risk_level,
      confidence_score: doc.data().confidence_score,
      source_ip:        doc.data().source_ip,
      userId:           doc.data().userId,
      user_email:       doc.data().user_email,
      // detection_method is stored inside raw_input for auth-rule records
      detection_method: doc.data().raw_input?.detection_method || 'ml_auto',
      timestamp:        doc.data().timestamp?.toDate()?.toISOString(),
    }));

    return res.json({ threats, count: threats.length });
  } catch (err) {
    console.error('[threatController.getThreats]', err);
    return res.status(500).json({ message: 'Failed to retrieve threats.' });
  }
}

// ─────────────────────────────────────────────────────────────
// THREAT STATS
// GET /api/threats/stats
// ─────────────────────────────────────────────────────────────
async function getThreatStats(req, res) {
  try {
    let query = db.collection(COLLECTIONS.THREAT_LOGS);
    if (req.user.role !== 'admin') {
      query = query.where('userId', '==', req.user.id);
    }

    const snap = await query.get();
    let high = 0, medium = 0, low = 0;
    const catCounts = {};
    const timeMap   = {};

    snap.docs.forEach(doc => {
      const d = doc.data();

      // Count risk levels
      if (d.risk_level === 'High')        high++;
      else if (d.risk_level === 'Medium') medium++;
      else                                low++;

      // Count attack categories (based on actual ML prediction)
      const cat = d.attack_type || 'Unknown';
      catCounts[cat] = (catCounts[cat] || 0) + 1;

      // Group by date for timeline (Normal vs Attack)
      const date = d.timestamp?.toDate()?.toLocaleDateString() || 'Unknown';
      if (!timeMap[date]) timeMap[date] = { normal: 0, attack: 0 };

      // ML-detected Normal/Attack records
      if (d.attack_type === 'Normal') {
        timeMap[date].normal++;
      } else if (d.attack_type === 'Attack' || d.attack_type === 'Brute Force Attempt') {
        // 'Brute Force Attempt' = authentication_rule detection = is an attack event
        timeMap[date].attack++;
      }
    });

    const categories = Object.entries(catCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const timeline = Object.entries(timeMap)
      .map(([time, vals]) => ({ time, ...vals }))
      .slice(-14);  // last 14 days

    return res.json({
      total: snap.size,
      high, medium, low,
      categories,
      timeline,
    });
  } catch (err) {
    console.error('[threatController.getThreatStats]', err);
    return res.status(500).json({ message: 'Failed to retrieve threat stats.' });
  }
}

// ─────────────────────────────────────────────────────────────
// RECENT THREATS
// GET /api/threats/recent
// ─────────────────────────────────────────────────────────────
async function getRecentThreats(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    let query   = db.collection(COLLECTIONS.THREAT_LOGS).orderBy('timestamp', 'desc');
    if (req.user.role !== 'admin') {
      query = query.where('userId', '==', req.user.id);
    }

    const snap    = await query.limit(limit).get();
    const threats = snap.docs.map(doc => ({
      id:               doc.id,
      attack_type:      doc.data().attack_type,
      risk_level:       doc.data().risk_level,
      confidence_score: doc.data().confidence_score,
      source_ip:        doc.data().source_ip,
      detection_method: doc.data().raw_input?.detection_method || 'ml_auto',
      timestamp:        doc.data().timestamp?.toDate()?.toISOString(),
    }));

    return res.json({ threats });
  } catch (err) {
    console.error('[threatController.getRecentThreats]', err);
    return res.status(500).json({ message: 'Failed to retrieve recent threats.' });
  }
}

// ─────────────────────────────────────────────────────────────
// THREAT DETAIL
// GET /api/threats/:id
// Returns full threat record + correlated activity logs for the
// same user within a ±30-minute window of the threat timestamp.
// Admin only — regular users cannot query arbitrary threat IDs.
// ─────────────────────────────────────────────────────────────
async function getThreatById(req, res) {
  try {
    const { id } = req.params;

    // Fetch the threat document
    const threatDoc = await db.collection(COLLECTIONS.THREAT_LOGS).doc(id).get();
    if (!threatDoc.exists) {
      return res.status(404).json({ message: 'Threat record not found.' });
    }

    const t = threatDoc.data();
    const threat = {
      id:               threatDoc.id,
      attack_type:      t.attack_type,
      risk_level:       t.risk_level,
      confidence_score: t.confidence_score,
      source_ip:        t.source_ip,
      userId:           t.userId,
      user_email:       t.user_email,
      raw_input:        t.raw_input || {},
      timestamp:        t.timestamp?.toDate()?.toISOString() || null,
    };

    // ── Correlated activity logs ──────────────────────────────
    // Query by userId only (single-field index, always available).
    // Sort and window-filter in memory to avoid the composite index
    // that Firestore requires for userId + orderBy(timestamp).
    const actSnap = await db.collection(COLLECTIONS.ACTIVITY_LOGS)
      .where('userId', '==', t.userId)
      .get();

    const threatTs = t.timestamp?.toDate()?.getTime() || 0;
    const WINDOW   = 30 * 60 * 1000; // 30 minutes in ms

    const relatedActivity = actSnap.docs
      .map(doc => {
        const d = doc.data();
        const ts = d.timestamp?.toDate()?.toISOString() || null;
        return {
          id:         doc.id,
          event_type: d.event_type,
          details:    d.details,
          ip_address: d.ip_address,
          timestamp:  ts,
          _ms:        d.timestamp?.toDate()?.getTime() || 0,
        };
      })
      .filter(a => threatTs === 0 || Math.abs(a._ms - threatTs) <= WINDOW)
      .map(({ _ms, ...a }) => a);

    // ── Login attempts ────────────────────────────────────────
    // Count login / login_failed events for this user across all
    // time so the admin can see if brute-force preceded the threat.
    const loginEvents  = actSnap.docs.filter(d => d.data().event_type === 'login').length;
    const failedLogins = actSnap.docs.filter(d => d.data().event_type === 'login_failed').length;

    // ── File activity near the threat ─────────────────────────
    const FILE_EVENTS = ['file_upload', 'file_download', 'file_delete'];
    const fileActivity = relatedActivity.filter(a => FILE_EVENTS.includes(a.event_type));

    // ── Most recent login before this threat ─────────────────
    const logins = actSnap.docs
      .filter(d => d.data().event_type === 'login')
      .map(d => ({ ts: d.data().timestamp?.toDate()?.getTime() || 0, iso: d.data().timestamp?.toDate()?.toISOString() }))
      .filter(l => l.ts <= (threatTs || Infinity))
      .sort((a, b) => b.ts - a.ts);
    const lastLoginTime = logins[0]?.iso || null;

    return res.json({
      threat,
      loginAttempts: {
        successful: loginEvents,
        failed:     failedLogins,
        lastLogin:  lastLoginTime,
      },
      relatedActivity,
      fileActivity,
    });
  } catch (err) {
    console.error('[threatController.getThreatById]', err);
    return res.status(500).json({ message: 'Failed to retrieve threat detail.' });
  }
}

module.exports = { analyzeActivity, getThreats, getThreatStats, getRecentThreats, getThreatById };
