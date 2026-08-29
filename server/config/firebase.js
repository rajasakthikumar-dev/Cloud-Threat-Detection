/**
 * config/firebase.js
 * -------------------
 * Firebase Admin SDK initialisation and Firestore helpers.
 *
 * Stores ALL logs and records — no SQL/MongoDB used:
 *   Collection  "users"          — user profiles and metadata
 *   Collection  "activity_logs"  — every platform action
 *   Collection  "threat_logs"    — ML service predictions
 *   Collection  "file_metadata"  — S3 file records
 *
 * Requires ONE of these in server/.env:
 *
 *   Option A — Service account JSON path:
 *     FIREBASE_SERVICE_ACCOUNT_PATH=./config/serviceAccount.json
 *
 *   Option B — Individual environment variables:
 *     FIREBASE_PROJECT_ID
 *     FIREBASE_CLIENT_EMAIL
 *     FIREBASE_PRIVATE_KEY   (include literal \n for newlines)
 *     FIREBASE_DATABASE_URL  (optional, for Realtime Database)
 */

const admin = require('firebase-admin');

// ─────────────────────────────────────────────────────────────
// INITIALISE (only once — guard against hot-reload reinit)
// ─────────────────────────────────────────────────────────────
// Detect placeholder / missing credentials — skip real init in that case
const _fbProject = process.env.FIREBASE_PROJECT_ID  || '';
const _fbKey     = process.env.FIREBASE_PRIVATE_KEY || '';
const _fbEmail   = process.env.FIREBASE_CLIENT_EMAIL || '';
const _fbConfigured = (
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  (
    _fbProject && !_fbProject.includes('REPLACE') &&
    _fbKey     && !_fbKey.includes('REPLACE') &&
    _fbEmail   && !_fbEmail.includes('REPLACE')
  )
);

if (!admin.apps.length) {
  if (!_fbConfigured) {
    console.warn(
      '[Firebase] WARNING: credentials not configured — ' +
      'running in no-op mode. Set FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in server/.env ' +
      'to enable Firestore logging.'
    );
    // Initialise with a minimal mock so admin.apps.length > 0
    // and the module can be required without crashing.
    try {
      admin.initializeApp({ projectId: 'mock-project' });
    } catch (_) { /* already initialised */ }
  } else {
    try {
      let credential;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        const serviceAccount = require(
          require('path').resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
        );
        credential = admin.credential.cert(serviceAccount);
      } else {
        credential = admin.credential.cert({
          projectId:   _fbProject,
          clientEmail: _fbEmail,
          privateKey:  _fbKey.replace(/\\n/g, '\n'),
        });
      }
      admin.initializeApp({
        credential,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
      console.log('[Firebase] Admin SDK initialised.');
    } catch (err) {
      console.error('[Firebase] Initialisation failed:', err.message);
      console.warn('[Firebase] Running in no-op mode — Firestore disabled.');
      if (!admin.apps.length) {
        try { admin.initializeApp({ projectId: 'mock-project' }); } catch (_) {}
      }
    }
  }
}

const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
// COLLECTION NAMES
// ─────────────────────────────────────────────────────────────
const COLLECTIONS = {
  USERS:         'users',
  ACTIVITY_LOGS: 'activity_logs',
  THREAT_LOGS:   'threat_logs',
  FILE_METADATA: 'file_metadata',
};

// ─────────────────────────────────────────────────────────────
// LOGGING HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Write a structured activity log entry to Firestore.
 *
 * @param {object} params
 * @param {string} params.userId      — Firestore user document ID
 * @param {string} params.userEmail
 * @param {string} params.event_type  — e.g. 'login', 'file_upload', 'threat_detected'
 * @param {string} [params.details]   — human-readable description
 * @param {string} [params.ip_address]
 * @param {object} [params.metadata]  — arbitrary extra data
 */
async function logActivity({ userId, userEmail, event_type, details = '', ip_address = '', metadata = {} }) {
  try {
    await db.collection(COLLECTIONS.ACTIVITY_LOGS).add({
      userId,
      user_email:  userEmail,
      event_type,
      details,
      ip_address,
      metadata,
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Log to console but never crash the request pipeline
    console.error('[Firebase] logActivity error:', err.message);
  }
}

/**
 * Write a threat detection result to Firestore.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.userEmail
 * @param {string} params.attack_type
 * @param {string} params.risk_level       — 'Low' | 'Medium' | 'High'
 * @param {number} params.confidence_score — 0–100
 * @param {string} [params.source_ip]
 * @param {object} [params.raw_input]      — original feature data
 */
async function logThreat({ userId, userEmail, attack_type, risk_level, confidence_score, source_ip = '', raw_input = {} }) {
  try {
    const docRef = await db.collection(COLLECTIONS.THREAT_LOGS).add({
      userId,
      user_email:       userEmail,
      attack_type,
      risk_level,
      confidence_score,
      source_ip,
      raw_input,
      timestamp:        admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.error('[Firebase] logThreat error:', err.message);
    return null;
  }
}

/**
 * Save S3 file metadata to Firestore after a successful upload.
 */
async function saveFileMetadata({ userId, userEmail, key, name, size, mimeType, s3Url }) {
  try {
    const docRef = await db.collection(COLLECTIONS.FILE_METADATA).add({
      userId,
      user_email: userEmail,
      key,
      name,
      size,
      mimeType,
      s3Url,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.error('[Firebase] saveFileMetadata error:', err.message);
    return null;
  }
}

/**
 * Delete file metadata from Firestore by S3 key.
 */
async function deleteFileMetadata(key) {
  try {
    const snap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('key', '==', key).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  } catch (err) {
    console.error('[Firebase] deleteFileMetadata error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// USER HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Create or overwrite a user document in Firestore.
 */
async function saveUser({ id, name, email, role, passwordHash }) {
  await db.collection(COLLECTIONS.USERS).doc(id).set({
    name, email, role, passwordHash,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Find a user document by email.
 * Returns the document data + its ID, or null if not found.
 */
async function findUserByEmail(email) {
  const snap = await db.collection(COLLECTIONS.USERS)
    .where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Find a user by their Firestore document ID.
 */
async function findUserById(id) {
  const doc = await db.collection(COLLECTIONS.USERS).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Fetch all user documents (admin use).
 */
async function getAllUsers() {
  const snap = await db.collection(COLLECTIONS.USERS)
    .orderBy('createdAt', 'desc').get();
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate()?.toISOString(),
      updatedAt: data.updatedAt?.toDate()?.toISOString(),
    };
  });
}

/**
 * Update specific fields on a user document.
 */
async function updateUser(id, fields) {
  await db.collection(COLLECTIONS.USERS).doc(id).update({
    ...fields,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Delete a user document.
 */
async function deleteUserById(id) {
  await db.collection(COLLECTIONS.USERS).doc(id).delete();
}

module.exports = {
  admin,
  db,
  COLLECTIONS,
  // Logging
  logActivity,
  logThreat,
  saveFileMetadata,
  deleteFileMetadata,
  // Users
  saveUser,
  findUserByEmail,
  findUserById,
  getAllUsers,
  updateUser,
  deleteUserById,
};
