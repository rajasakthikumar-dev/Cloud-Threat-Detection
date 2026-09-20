/**
 * utils/bruteForceMonitor.js
 * ---------------------------
 * Rule-based authentication-failure monitor.
 *
 * WHAT THIS IS
 * ─────────────
 * A sliding-window failed-login counter.  Every time a user fails to log in,
 * authController calls checkBruteForce().  This function:
 *
 *   1. Queries Firestore activity_logs for recent login_failed events for
 *      this userId within the configured time window.
 *   2. Applies threshold rules (from securityRules.js).
 *   3. If a threshold is crossed, writes a REAL threat record to threat_logs
 *      with source='authentication_rule' and an honest attack_type label.
 *   4. If the HIGH threshold is crossed, applies a temporary account
 *      restriction using the SAME mechanism as manual admin restrictions.
 *
 * WHAT THIS IS NOT
 * ─────────────────
 * This is NOT the LSTM model.  The LSTM (NumpyLSTMPredictor) was trained on
 * 42-feature UNSW-NB15 network packet/flow data.  It has no concept of
 * failed authentication events.  Calling the ML service with zeroed-out
 * features to "simulate" brute-force detection would be dishonest and
 * would produce meaningless predictions.
 *
 * The two detection paths are kept COMPLETELY SEPARATE:
 *   - 'authentication_rule'  ← this file
 *   - 'ml_auto'              ← threatController.analyzeActivity()
 *
 * DEDUPLICATION
 * ─────────────
 * An in-memory cooldown map (userId → last threat timestamp) prevents
 * creating a new threat record on every single failure once a threshold
 * has been crossed.  New threat records are written at most once per
 * COOLDOWN_MS window per user.
 */

const { db, COLLECTIONS, logThreat, logActivity, updateUser, findUserById } =
  require('../config/firebase');
const { BRUTE_FORCE } = require('../config/securityRules');

// ── In-memory cooldown map ────────────────────────────────────
// userId → { lastThreatAt: ms, lastLevel: 'Medium'|'High' }
// Prevents flood of duplicate threat records during a single burst.
const _cooldown = new Map();

/**
 * Count recent login_failed events for this user from Firestore.
 * We always read from Firestore (not just the in-memory map) so that
 * failures across multiple server instances / restarts are counted.
 *
 * @param {string} userId
 * @param {number} windowMs
 * @returns {Promise<number>}
 */
async function _countRecentFailures(userId, windowMs) {
  const cutoff = new Date(Date.now() - windowMs);

  // Single-field query (no composite index needed).
  // We over-fetch by userId and filter by timestamp in memory.
  const snap = await db.collection(COLLECTIONS.ACTIVITY_LOGS)
    .where('userId', '==', userId)
    .where('event_type', '==', 'login_failed')
    .get();

  let count = 0;
  snap.docs.forEach(doc => {
    const ts = doc.data().timestamp?.toDate?.();
    if (ts && ts >= cutoff) count++;
  });

  return count;
}

/**
 * Apply a temporary account restriction with authentication_rule source.
 * Reuses EXACTLY the same Firestore fields as manual admin restrictions
 * and ML auto-restrictions — same enforcement, different label.
 */
async function _applyRestriction(userId, userEmail, failCount, clientIp) {
  const now        = new Date();
  const expiryDate = new Date(now.getTime() + BRUTE_FORCE.RESTRICTION_MINUTES * 60 * 1000);
  const reason     = `Authentication Rule: ${failCount} failed login attempts detected within ${BRUTE_FORCE.WINDOW_MS / 60000} minutes`;

  await updateUser(userId, {
    restricted:          true,
    restrictedAt:        now.toISOString(),
    restrictionExpiry:   expiryDate.toISOString(),
    restrictionReason:   reason,
    restrictionSource:   'authentication_rule',   // honest label — NOT 'ml_auto'
    restrictedBy:        'system (authentication rule)',
    mlRiskScore:         null,
    mlAttackType:        null,
    releasedAt:          null,
  });

  await logActivity({
    userId,
    userEmail,
    event_type: 'user_restricted',
    details:    `[AUTH RULE] ${reason} — account restricted for ${BRUTE_FORCE.RESTRICTION_MINUTES} minutes`,
    ip_address: clientIp,
  });

  console.log(
    `[bruteForceMonitor] RESTRICTION applied to ${userEmail} — ${failCount} failures, expires ${expiryDate.toISOString()}`
  );
}

/**
 * Create a real threat_log record for the authentication event.
 * Uses real data: userId, userEmail, IP, timestamp, failCount.
 * Does NOT invent LSTM predictions.
 *
 * @param {string} userId
 * @param {string} userEmail
 * @param {'Medium'|'High'} riskLevel
 * @param {number} failCount
 * @param {string} clientIp
 */
async function _logThreatRecord(userId, userEmail, riskLevel, failCount, clientIp) {
  const confidenceScore = riskLevel === 'High' ? 90 : 60;
  const details = `${failCount} failed login attempts in ${BRUTE_FORCE.WINDOW_MS / 60000} minutes`;

  const threatId = await logThreat({
    userId,
    userEmail,
    attack_type:      'Brute Force Attempt',
    risk_level:       riskLevel,
    confidence_score: confidenceScore,
    source_ip:        clientIp,
    raw_input: {
      detection_method:   'authentication_rule',
      failed_attempts:    failCount,
      window_minutes:     BRUTE_FORCE.WINDOW_MS / 60000,
      threshold_warning:  BRUTE_FORCE.WARNING_COUNT,
      threshold_high:     BRUTE_FORCE.HIGH_COUNT,
      event_description:  details,
    },
  });

  console.log(
    `[bruteForceMonitor] Threat record created — id=${threatId} user=${userEmail} ` +
    `risk=${riskLevel} failures=${failCount}`
  );
  return threatId;
}

/**
 * checkBruteForce
 * ----------------
 * Called by authController after every failed login attempt.
 *
 * @param {object} params
 * @param {string} params.userId      — Firestore user document ID
 * @param {string} params.userEmail
 * @param {string} [params.clientIp]  — real client IP from request
 */
async function checkBruteForce({ userId, userEmail, clientIp = '' }) {
  try {
    // Count failures in the sliding window
    const failCount = await _countRecentFailures(userId, BRUTE_FORCE.WINDOW_MS);

    console.log(
      `[bruteForceMonitor] user=${userEmail} failures_in_window=${failCount} ` +
      `warning_threshold=${BRUTE_FORCE.WARNING_COUNT} high_threshold=${BRUTE_FORCE.HIGH_COUNT}`
    );

    // Below warning threshold — nothing to do
    if (failCount < BRUTE_FORCE.WARNING_COUNT) return;

    // ── Determine risk level ──────────────────────────────────
    const riskLevel = failCount >= BRUTE_FORCE.HIGH_COUNT ? 'High' : 'Medium';

    // ── Cooldown check — avoid duplicate records for same burst ─
    const now = Date.now();
    const cooldownEntry = _cooldown.get(userId);
    const inCooldown = (
      cooldownEntry &&
      (now - cooldownEntry.lastThreatAt) < BRUTE_FORCE.COOLDOWN_MS &&
      cooldownEntry.lastLevel === riskLevel
    );

    if (inCooldown) {
      console.log(
        `[bruteForceMonitor] Cooldown active for ${userEmail} — skipping duplicate threat record`
      );
      // Still check if restriction needs to be applied (in case server restarted)
    } else {
      // Write a real threat record
      await _logThreatRecord(userId, userEmail, riskLevel, failCount, clientIp);

      // Update cooldown
      _cooldown.set(userId, { lastThreatAt: now, lastLevel: riskLevel });
    }

    // ── Apply restriction at HIGH threshold ───────────────────
    if (riskLevel === 'High') {
      // Read current user state to avoid duplicating an active restriction
      const currentUser = await findUserById(userId);

      if (!currentUser) return;

      // Never restrict admins
      if (currentUser.role === 'admin') {
        console.log(`[bruteForceMonitor] Skipping restriction — ${userEmail} is admin`);
        return;
      }

      let alreadyRestricted = currentUser.restricted === true;
      if (alreadyRestricted && currentUser.restrictionExpiry) {
        const expiry = new Date(currentUser.restrictionExpiry).getTime();
        if (!isNaN(expiry) && expiry <= now) {
          alreadyRestricted = false; // Expired — can apply fresh restriction
        }
      }

      if (!alreadyRestricted) {
        await _applyRestriction(userId, userEmail, failCount, clientIp);
      } else {
        console.log(
          `[bruteForceMonitor] HIGH risk for ${userEmail} but restriction already active — skipping duplicate`
        );
      }
    }

  } catch (err) {
    // Never crash the login response — brute-force check is fire-and-forget
    console.error('[bruteForceMonitor] Error in checkBruteForce:', err.message);
  }
}

module.exports = { checkBruteForce };
