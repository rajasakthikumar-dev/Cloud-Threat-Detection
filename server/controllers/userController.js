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

// ─────────────────────────────────────────────────────────────
// GET ALL USERS  (admin only)
// GET /api/users
// ─────────────────────────────────────────────────────────────
async function listUsers(req, res) {
  try {
    const users = await getAllUsers();
    // Strip password hashes before sending
    const safe  = users.map(({ passwordHash, ...u }) => u);
    return res.json({ users: safe });
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

    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'user_deleted',
      details:    `Admin deleted user: ${target.email}`,
      ip_address: req.ip,
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

    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'role_changed',
      details:    `Changed role of ${target.email} from "${target.role}" to "${role}"`,
      ip_address: req.ip,
    });

    return res.json({ message: `Role updated to "${role}".` });
  } catch (err) {
    console.error('[userController.updateRole]', err);
    return res.status(500).json({ message: 'Failed to update role.' });
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
// Shows user metadata, real calculated files stored count, and last activity.
// Does NOT expose user file contents.
// ─────────────────────────────────────────────────────────────
async function getUserActivitySummary(req, res) {
  try {
    const [usersSnap, filesSnap, logsSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).get(),
      db.collection(COLLECTIONS.FILE_METADATA).get(),
      db.collection(COLLECTIONS.ACTIVITY_LOGS).get(),
    ]);

    // Aggregate real files stored count per user
    const fileCountMap = {};
    filesSnap.docs.forEach(doc => {
      const uId = doc.data().userId;
      if (uId) {
        fileCountMap[uId] = (fileCountMap[uId] || 0) + 1;
      }
    });

    // Map last activity per user ID / email
    const lastActivityMap = {};
    logsSnap.docs.forEach(doc => {
      const d = doc.data();
      const uId = d.userId;
      const email = d.user_email;
      let ts = null;
      if (d.timestamp?.toDate) {
        ts = d.timestamp.toDate().toISOString();
      } else if (d.timestamp) {
        ts = new Date(d.timestamp).toISOString();
      }

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

        return {
          id,
          name:         u.name || '—',
          email:        u.email || '—',
          role:         u.role || 'user',
          filesStored:  fileCountMap[id] || 0,
          lastActivity: lastAct,
          createdAt:    created,
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

module.exports = {
  listUsers,
  deleteUser,
  updateRole,
  getUserStats,
  getAdminStats,
  getActivityLogs,
  getUserActivitySummary,
};

