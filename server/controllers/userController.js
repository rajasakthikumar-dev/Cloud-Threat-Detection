/**
 * controllers/userController.js
 * --------------------------------
 * User management and statistics endpoints.
 * All data lives in Firebase Firestore (custom auth — no Firebase Auth).
 *
 * IMPORTANT: This application uses custom authentication (bcrypt + UUID +
 * Firestore + JWT).  Users are NOT Firebase Authentication users.
 * User IDs are uuidv4() strings, not Firebase Auth UIDs.
 * Do NOT call admin.auth().deleteUser() or admin.auth().setCustomUserClaims()
 * here — those APIs operate on Firebase Auth and will always throw
 * auth/user-not-found because no Firebase Auth accounts exist.
 */

const {
  getAllUsers,
  findUserById,
  updateUser,
  deleteUserById,
  logActivity,
  db,
  COLLECTIONS,
} = require('../config/firebase');

const { getClientInfo, formatClientInfo } = require('../utils/deviceParser');

// ─────────────────────────────────────────────────────────────
// GET ALL USERS  (admin only)
// GET /api/users
// MODULE 1: Includes security_status, risk score, and full restriction details
// ─────────────────────────────────────────────────────────────
async function listUsers(req, res) {
  try {
    const users = await getAllUsers();
    
    // Fetch ALL threats once, filter in memory to avoid Firestore index issues
    const allThreatsSnap = await db.collection(COLLECTIONS.THREAT_LOGS).get();
    
    // Build threat map by userId
    const threatsByUser = {};
    allThreatsSnap.docs.forEach(doc => {
      const threat = doc.data();
      const uId = threat.userId;
      if (uId) {
        if (!threatsByUser[uId]) threatsByUser[uId] = [];
        threatsByUser[uId].push(threat);
      }
    });
    
    const now = new Date();

    // MODULE 1: Calculate security status + restriction details for each user
    const enrichedUsers = users.map(user => {
      const userThreats = threatsByUser[user.id] || [];
      
      // Calculate risk score from real ML data (last 10 threats)
      let riskScore = 0;
      let highRiskCount = 0;
      
      userThreats
        .sort((a, b) => {
          const tsA = a.timestamp?.toDate?.()?.getTime() || 0;
          const tsB = b.timestamp?.toDate?.()?.getTime() || 0;
          return tsB - tsA;
        })
        .slice(0, 10)
        .forEach(threat => {
          if (threat.risk_level === 'High') {
            riskScore += 10;
            highRiskCount++;
          } else if (threat.risk_level === 'Medium') {
            riskScore += 5;
          } else if (threat.risk_level === 'Low') {
            riskScore += 1;
          }
        });

      // MODULE 1: Auto-expire restrictions whose expiry time has passed
      let isRestricted = user.restricted === true;
      if (isRestricted && user.restrictionExpiry) {
        const expiry = new Date(user.restrictionExpiry);
        if (!isNaN(expiry.getTime()) && expiry <= now) {
          // Expired — treat as not restricted (background expiry; Firestore write
          // happens lazily on next admin action to avoid blocking list response)
          isRestricted = false;
        }
      }
      
      // Determine security status based on real data
      let securityStatus = 'Normal';
      if (isRestricted) {
        securityStatus = 'Restricted';
      } else if (highRiskCount >= 3 || riskScore >= 30) {
        securityStatus = 'Warning';
      }
      
      // Strip password hash
      const { passwordHash, ...safeUser } = user;
      
      // Build restriction details block
      const restrictionDetails = isRestricted ? {
        restrictionStatus:  'Temporary Restricted',
        restrictionReason:  user.restrictionReason  || 'No reason provided',
        restrictionSource:  user.restrictionSource  || 'manual',  // 'manual' | 'ml_auto'
        restrictedBy:       user.restrictedBy       || '—',
        restrictedAt:       user.restrictedAt       || null,
        restrictionExpiry:  user.restrictionExpiry  || null,
        mlRiskScore:        user.mlRiskScore        || null,
        mlAttackType:       user.mlAttackType       || null,
      } : {
        restrictionStatus: 'Not Restricted',
        restrictionReason: null,
        restrictionSource: null,
        restrictedBy:      null,
        restrictedAt:      null,
        restrictionExpiry: null,
        mlRiskScore:       null,
        mlAttackType:      null,
      };

      return {
        ...safeUser,
        security_status: securityStatus,
        risk_score:      riskScore,
        restricted:      isRestricted,
        ...restrictionDetails,
      };
    });
    
    return res.json({ users: enrichedUsers });
  } catch (err) {
    console.error('[userController.listUsers]', err);
    return res.status(500).json({ message: 'Failed to retrieve users.' });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE USER  (admin only)
// DELETE /api/users/:id
// ─────────────────────────────────────────────────────────────
async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Prevent admin from deleting their own account
    if (id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    const target = await findUserById(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    // Delete the Firestore user document.
    // This is the only user store — custom auth means no Firebase Auth account exists.
    // After deletion the user cannot log in because findUserByEmail() will return null.
    await deleteUserById(id);

    const clientInfo = getClientInfo(req);
    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'user_deleted',
      details:    `Admin deleted user: ${target.email} from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device:     clientInfo.device,
      os:         clientInfo.os,
      browser:    clientInfo.browser,
      user_agent: clientInfo.userAgent,
    });

    return res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('[userController.deleteUser]', err);
    return res.status(500).json({ message: 'Failed to delete user.' });
  }
}

// ─────────────────────────────────────────────────────────────
// UPDATE ROLE  (admin only)
// PATCH /api/users/:id/role
// ─────────────────────────────────────────────────────────────
async function updateRole(req, res) {
  try {
    const { id }   = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role must be "user" or "admin".' });
    }

    const target = await findUserById(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    // Update Firestore — the role is read from Firestore on every login
    // and embedded in the JWT, so the change takes effect on next login.
    await updateUser(id, { role });

    const clientInfo = getClientInfo(req);
    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'role_changed',
      details:    `Changed role of ${target.email} from "${target.role}" to "${role}" from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device:     clientInfo.device,
      os:         clientInfo.os,
      browser:    clientInfo.browser,
      user_agent: clientInfo.userAgent,
    });

    return res.json({ message: `Role updated to "${role}".` });
  } catch (err) {
    console.error('[userController.updateRole]', err);
    return res.status(500).json({ message: 'Failed to update role.' });
  }
}

// ─────────────────────────────────────────────────────────────
// MODULE 1: RESTRICT USER  (admin only)
// PATCH /api/users/:id/restrict
// Body: { reason, expiryMinutes, source, mlRiskScore, mlAttackType }
// Temporarily restricts a user account — never permanent.
// Also callable internally by the ML auto-restriction flow.
// ─────────────────────────────────────────────────────────────
async function restrictUser(req, res) {
  try {
    const { id } = req.params;
    const {
      reason        = 'Manually restricted by admin',
      expiryMinutes = 30,
      source        = 'manual',   // 'manual' | 'ml_auto'
      mlRiskScore   = null,
      mlAttackType  = null,
    } = req.body || {};

    // Prevent admin from restricting themselves
    if (id === req.user.id) {
      return res.status(400).json({ message: 'You cannot restrict your own account.' });
    }
    
    const target = await findUserById(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    
    // Prevent restricting admin accounts
    if (target.role === 'admin') {
      return res.status(403).json({ message: 'Cannot restrict admin accounts.' });
    }

    // Validate expiry: clamp between 5 minutes and 7 days
    const clampedMinutes = Math.max(5, Math.min(Number(expiryMinutes) || 30, 10080));
    const now = new Date();
    const expiryDate = new Date(now.getTime() + clampedMinutes * 60 * 1000);

    await updateUser(id, { 
      restricted:          true,
      restrictedAt:        now.toISOString(),
      restrictionExpiry:   expiryDate.toISOString(),
      restrictionReason:   String(reason).slice(0, 500),  // cap length
      restrictionSource:   source,                        // 'manual' or 'ml_auto'
      restrictedBy:        req.user.email,
      mlRiskScore:         mlRiskScore,
      mlAttackType:        mlAttackType,
      releasedAt:          null,
    });
    
    const clientInfo = getClientInfo(req);
    const logDetails = source === 'ml_auto'
      ? `ML auto-restricted user: ${target.email} — ${reason} (expires in ${clampedMinutes} min)`
      : `Admin restricted user: ${target.email} — Reason: ${reason} (expires in ${clampedMinutes} min) from ${formatClientInfo(clientInfo)}`;

    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'user_restricted',
      details:    logDetails,
      ip_address: clientInfo.ip,
      device:     clientInfo.device,
      os:         clientInfo.os,
      browser:    clientInfo.browser,
      user_agent: clientInfo.userAgent,
    });
    
    return res.json({
      message:           `User account temporarily restricted for ${clampedMinutes} minutes.`,
      restricted:        true,
      restrictionExpiry: expiryDate.toISOString(),
      restrictionReason: reason,
      restrictionSource: source,
    });
  } catch (err) {
    console.error('[userController.restrictUser]', err);
    return res.status(500).json({ message: 'Failed to restrict user.' });
  }
}

// ─────────────────────────────────────────────────────────────
// MODULE 1: RELEASE RESTRICTION  (admin only)
// PATCH /api/users/:id/release
// Release a temporary account restriction — clears all restriction fields.
// ─────────────────────────────────────────────────────────────
async function releaseRestriction(req, res) {
  try {
    const { id } = req.params;
    
    const target = await findUserById(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    
    // Remove restriction and clear all associated fields
    await updateUser(id, { 
      restricted:          false,
      restrictedAt:        null,
      restrictionExpiry:   null,
      restrictionReason:   null,
      restrictionSource:   null,
      restrictedBy:        null,
      mlRiskScore:         null,
      mlAttackType:        null,
      releasedAt:          new Date().toISOString(),
      releasedBy:          req.user.email,
    });
    
    const clientInfo = getClientInfo(req);
    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'restriction_released',
      details:    `Admin released restriction for user: ${target.email} from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device:     clientInfo.device,
      os:         clientInfo.os,
      browser:    clientInfo.browser,
      user_agent: clientInfo.userAgent,
    });
    
    return res.json({ message: 'Account restriction released.', restricted: false });
  } catch (err) {
    console.error('[userController.releaseRestriction]', err);
    return res.status(500).json({ message: 'Failed to release restriction.' });
  }
}

// ─────────────────────────────────────────────────────────────
// USER STATS  (own account)
// GET /api/users/stats
// ─────────────────────────────────────────────────────────────
async function getUserStats(req, res) {
  try {
    const userId = req.user.id;

    // Count user's files
    const filesSnap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('userId', '==', userId).get();

    // Count user's threats
    const threatsSnap = await db.collection(COLLECTIONS.THREAT_LOGS)
      .where('userId', '==', userId).get();

    // Get most recent scan timestamp
    const lastScanSnap = await db.collection(COLLECTIONS.THREAT_LOGS)
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(1).get();

    const lastScan = lastScanSnap.empty
      ? 'Never'
      : lastScanSnap.docs[0].data().timestamp?.toDate()?.toLocaleDateString() || '—';

    const threatCount = threatsSnap.size;
    const status      = threatCount > 0 ? 'At Risk' : 'Secure';

    return res.json({
      myFiles:  filesSnap.size,
      myThreats: threatCount,
      lastScan,
      status,
    });
  } catch (err) {
    console.error('[userController.getUserStats]', err);
    return res.status(500).json({ message: 'Failed to retrieve stats.' });
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN STATS  (admin only)
// GET /api/users/admin/stats
// ─────────────────────────────────────────────────────────────
async function getAdminStats(req, res) {
  try {
    const [usersSnap, filesSnap, threatsSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).get(),
      db.collection(COLLECTIONS.FILE_METADATA).get(),
      db.collection(COLLECTIONS.THREAT_LOGS).get(),
    ]);

    // Active alerts = threats from the last 24 hours
    const oneDayAgo    = new Date(Date.now() - 86_400_000);
    const activeAlerts = threatsSnap.docs.filter(doc => {
      const ts = doc.data().timestamp?.toDate();
      return ts && ts > oneDayAgo;
    }).length;

    // Build risk distribution
    let high = 0, medium = 0, low = 0;
    threatsSnap.docs.forEach(doc => {
      const r = doc.data().risk_level;
      if (r === 'High')   high++;
      else if (r === 'Medium') medium++;
      else low++;
    });

    // Category breakdown
    const catCounts = {};
    threatsSnap.docs.forEach(doc => {
      const cat = doc.data().attack_type || 'Unknown';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(catCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      totalUsers:       usersSnap.size,
      totalFiles:       filesSnap.size,
      totalThreats:     threatsSnap.size,
      activeAlerts,
      riskDistribution: [
        { name: 'Low',    value: low    },
        { name: 'Medium', value: medium },
        { name: 'High',   value: high   },
      ],
      categoryBreakdown,
      trafficTimeline: [],   // populated by a separate analytics job
    });
  } catch (err) {
    console.error('[userController.getAdminStats]', err);
    return res.status(500).json({ message: 'Failed to retrieve admin stats.' });
  }
}

// ─────────────────────────────────────────────────────────────
// ACTIVITY LOGS  (admin only)
// GET /api/logs
// ─────────────────────────────────────────────────────────────
async function getActivityLogs(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);

    const snap = await db.collection(COLLECTIONS.ACTIVITY_LOGS)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const logs = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id:         doc.id,
        userId:     d.userId,
        user_email: d.user_email,
        event_type: d.event_type,
        details:    d.details,
        ip_address: d.ip_address,
        device:     d.device,
        os:         d.os,
        browser:    d.browser,
        user_agent: d.user_agent,
        timestamp:  d.timestamp?.toDate()?.toISOString(),
      };
    });

    return res.json({ logs, count: logs.length });
  } catch (err) {
    console.error('[userController.getActivityLogs]', err);
    return res.status(500).json({ message: 'Failed to retrieve logs.' });
  }
}

// ─────────────────────────────────────────────────────────────
// USER ACTIVITY SUMMARY  (admin only)
// GET /api/users/activity-summary
// FIX: Now shows individual login sessions instead of lifetime totals
// Shows user metadata, real calculated files stored count, and last activity.
// Does NOT expose user file contents.
// ─────────────────────────────────────────────────────────────
async function getUserActivitySummary(req, res) {
  try {
    const [usersSnap, filesSnap, logsSnap, threatsSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).get(),
      db.collection(COLLECTIONS.FILE_METADATA).get(),
      db.collection(COLLECTIONS.ACTIVITY_LOGS).get(),
      db.collection(COLLECTIONS.THREAT_LOGS).get(),
    ]);

    // Aggregate real files stored count per user
    const fileCountMap = {};
    filesSnap.docs.forEach(doc => {
      const uId = doc.data().userId;
      if (uId) {
        fileCountMap[uId] = (fileCountMap[uId] || 0) + 1;
      }
    });

    // FIX: Build complete login history per user (individual sessions)
    const loginHistoryMap = {};
    const deviceInfoMap = {};
    
    // Sort all logs by timestamp
    const sortedLogs = logsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const tsA = a.timestamp?.toDate?.()?.getTime() || 0;
        const tsB = b.timestamp?.toDate?.()?.getTime() || 0;
        return tsB - tsA;  // Most recent first
      });
    
    // Build login history (individual login events with timestamps)
    sortedLogs.forEach(d => {
      const uId = d.userId;
      if (!uId) return;
      
      // Initialize login history array for this user
      if (!loginHistoryMap[uId]) {
        loginHistoryMap[uId] = [];
      }
      
      // Capture login/logout events with full details
      if (d.event_type === 'login' || d.event_type === 'login_failed' || d.event_type === 'logout') {
        loginHistoryMap[uId].push({
          event_type: d.event_type,
          timestamp: d.timestamp?.toDate?.()?.toISOString() || null,
          device: d.device || '—',
          os: d.os || '—',
          browser: d.browser || '—',
          ip_address: d.ip_address || '—',
          details: d.details || '',
        });
      }
      
      // Capture most recent device info (only once per user)
      if (d.event_type === 'login' && !deviceInfoMap[uId] && (d.device || d.os || d.browser)) {
        deviceInfoMap[uId] = {
          device: d.device || '—',
          os: d.os || '—',
          browser: d.browser || '—',
        };
      }
    });

    // Map last activity per user ID / email
    const lastActivityMap = {};
    sortedLogs.forEach(d => {
      const uId = d.userId;
      const email = d.user_email;
      const ts = d.timestamp?.toDate?.()?.toISOString() || (d.timestamp ? new Date(d.timestamp).toISOString() : null);

      if (uId && ts) {
        if (!lastActivityMap[uId] || new Date(ts) > new Date(lastActivityMap[uId])) {
          lastActivityMap[uId] = ts;
        }
      }
      if (email && ts) {
        if (!lastActivityMap[email] || new Date(ts) > new Date(lastActivityMap[email])) {
          lastActivityMap[email] = ts;
        }
      }
    });
    
    // Build recent risk history per user from real ML and auth-rule data
    const riskHistoryMap = {};
    threatsSnap.docs.forEach(doc => {
      const threat = doc.data();
      const uId = threat.userId;
      
      if (!uId) return;
      
      if (!riskHistoryMap[uId]) {
        riskHistoryMap[uId] = [];
      }
      
      // Include ML detections and authentication_rule detections (both are real)
      if (threat.risk_level && threat.attack_type) {
        riskHistoryMap[uId].push({
          risk_level:       threat.risk_level,
          attack_type:      threat.attack_type,
          confidence_score: threat.confidence_score || 0,
          // detection_method distinguishes LSTM from auth-rule
          detection_method: threat.raw_input?.detection_method || 'ml_auto',
          timestamp:        threat.timestamp?.toDate?.()?.toISOString() || null,
        });
      }
    });
    
    // Sort risk history by timestamp (most recent first) and limit to 5
    Object.keys(riskHistoryMap).forEach(uId => {
      riskHistoryMap[uId] = riskHistoryMap[uId]
        .sort((a, b) => {
          const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5);
    });

    const userActivity = usersSnap.docs
      .map(doc => {
        const u = doc.data();
        const id = doc.id;
        let created = null;
        if (u.createdAt?.toDate) {
          created = u.createdAt.toDate().toISOString();
        } else if (u.createdAt) {
          created = new Date(u.createdAt).toISOString();
        }

        const lastAct = lastActivityMap[id] || (u.email ? lastActivityMap[u.email] : null) || created;
        
        // Get device info and login history
        const deviceInfo = deviceInfoMap[id] || { device: '—', os: '—', browser: '—' };
        const loginHistory = loginHistoryMap[id] || [];
        const riskHistory = riskHistoryMap[id] || [];

        return {
          id,
          name:         u.name || '—',
          email:        u.email || '—',
          role:         u.role || 'user',
          filesStored:  fileCountMap[id] || 0,
          lastActivity: lastAct,
          createdAt:    created,
          // FIX: Return individual login history instead of totals
          loginHistory: loginHistory.slice(0, 10),  // Last 10 login events
          device:       deviceInfo.device,
          os:           deviceInfo.os,
          browser:      deviceInfo.browser,
          riskHistory:  riskHistory,  // includes detection_method for each entry
        };
      })
      .sort((a, b) => {
        const timeA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const timeB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return timeB - timeA;
      });

    return res.json({ userActivity, count: userActivity.length });
  } catch (err) {
    console.error('[userController.getUserActivitySummary]', err);
    return res.status(500).json({ message: 'Failed to retrieve user activity summary.' });
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN SECURITY SUMMARY  (admin only)
// GET /api/users/admin/security-summary
//
// Returns all data needed for the 3 new dashboard security sections:
//   1. Restricted Accounts counts (total, manual, ml_auto, auth_rule)
//   2. Security Response counters (ml_auto, manual, auth_rule restrictions
//      raised historically from activity_logs)
//   3. Recent Security Activity — last 20 security-relevant activity log
//      events (login, login_failed, threat_detected, user_restricted,
//      restriction_released) across all users
//
// All data comes from existing Firestore collections — no new collections.
// ─────────────────────────────────────────────────────────────
async function getAdminSecuritySummary(req, res) {
  try {
    const now = new Date();

    // Single parallel fetch — users + activity_logs only
    // (threat_logs not needed here; threat counts come from getAdminStats)
    const [usersSnap, logsSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).get(),
      db.collection(COLLECTIONS.ACTIVITY_LOGS)
        .orderBy('timestamp', 'desc')
        .limit(200)           // enough history for counters + recent list
        .get(),
    ]);

    // ── Section 1 + 2: Restricted accounts ───────────────────
    let totalRestricted   = 0;
    let manualCount       = 0;
    let mlAutoCount       = 0;
    let authRuleCount     = 0;

    usersSnap.docs.forEach(doc => {
      const u = doc.data();

      // Skip admins (they can never be restricted)
      if (u.role === 'admin') return;

      let isRestricted = u.restricted === true;

      // Respect expiry inline — don't rely on stale Firestore state
      if (isRestricted && u.restrictionExpiry) {
        const expiry = new Date(u.restrictionExpiry);
        if (!isNaN(expiry.getTime()) && expiry <= now) {
          isRestricted = false;
        }
      }

      if (!isRestricted) return;

      totalRestricted++;
      const src = u.restrictionSource || 'manual';
      if (src === 'ml_auto')             mlAutoCount++;
      else if (src === 'authentication_rule') authRuleCount++;
      else                                manualCount++;
    });

    // ── Section 2 counters: all-time restriction events from logs ─
    // We count user_restricted events by source from the activity log.
    // This gives lifetime "Security Response" totals.
    let allTimeMlAuto     = 0;
    let allTimeManual     = 0;
    let allTimeAuthRule   = 0;
    let allTimeReleased   = 0;

    // ── Section 3: Recent security activity ──────────────────
    const SECURITY_EVENTS = new Set([
      'login',
      'login_failed',
      'threat_detected',
      'user_restricted',
      'restriction_released',
      'password_reset_requested',
      'password_reset_completed',
    ]);

    const recentActivity = [];

    logsSnap.docs.forEach(doc => {
      const d = doc.data();
      const eventType = d.event_type || '';

      // Count restriction events for section 2 counters
      if (eventType === 'user_restricted') {
        // Try to infer source from the details text if not stored as a field
        const details = (d.details || '').toLowerCase();
        if (d.restrictionSource === 'ml_auto' || details.includes('[ml auto]') || details.includes('ml auto-restriction') || details.includes('ml detection')) {
          allTimeMlAuto++;
        } else if (d.restrictionSource === 'authentication_rule' || details.includes('[auth rule]') || details.includes('authentication rule')) {
          allTimeAuthRule++;
        } else {
          allTimeManual++;
        }
      }
      if (eventType === 'restriction_released') {
        allTimeReleased++;
      }

      // Collect recent security events (max 20)
      if (SECURITY_EVENTS.has(eventType) && recentActivity.length < 20) {
        recentActivity.push({
          id:         doc.id,
          event_type: eventType,
          user_email: d.user_email  || d.userEmail || '—',
          details:    d.details     || '',
          ip_address: d.ip_address  || '—',
          timestamp:  d.timestamp?.toDate?.()?.toISOString() || null,
        });
      }
    });

    return res.json({
      // Section 1 — currently restricted right now
      restrictedAccounts: {
        total:          totalRestricted,
        manual:         manualCount,
        mlAuto:         mlAutoCount,
        authRule:       authRuleCount,
      },
      // Section 2 — all-time security response counters
      securityResponse: {
        mlAutoRestrictions:   allTimeMlAuto,
        manualRestrictions:   allTimeManual,
        authRuleRestrictions: allTimeAuthRule,
        restrictionsReleased: allTimeReleased,
        currentlyRestricted:  totalRestricted,
      },
      // Section 3 — recent security events (already sorted desc by query)
      recentSecurityActivity: recentActivity,
    });
  } catch (err) {
    console.error('[userController.getAdminSecuritySummary]', err);
    return res.status(500).json({ message: 'Failed to retrieve security summary.' });
  }
}

module.exports = {
  listUsers,
  deleteUser,
  updateRole,
  restrictUser,
  releaseRestriction,
  getUserStats,
  getAdminStats,
  getActivityLogs,
  getUserActivitySummary,
  getAdminSecuritySummary,
};

