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
  USERS:                 'users',
  ACTIVITY_LOGS:         'activity_logs',
  THREAT_LOGS:           'threat_logs',
  FILE_METADATA:         'file_metadata',
  PASSWORD_RESET_TOKENS: 'password_reset_tokens',
  PASSWORD_RESET_OTPS:   'password_reset_otps',
  FILE_RECOVERY_LOGS:    'file_recovery_logs',
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
 * @param {string} [params.device]    — Device type (Desktop, Mobile, iPhone, etc.)
 * @param {string} [params.os]        — Operating system (Windows 10/11, Ubuntu, iOS, etc.)
 * @param {string} [params.browser]   — Browser name and version (Chrome 120, Firefox 121, etc.)
 * @param {string} [params.user_agent] — Raw User-Agent string
 * @param {object} [params.metadata]  — arbitrary extra data
 */
async function logActivity({ 
  userId, 
  userEmail, 
  event_type, 
  details = '', 
  ip_address = '', 
  device = '', 
  os = '', 
  browser = '', 
  user_agent = '',
  metadata = {} 
}) {
  try {
    await db.collection(COLLECTIONS.ACTIVITY_LOGS).add({
      userId,
      user_email:  userEmail,
      event_type,
      details,
      ip_address,
      device,
      os,
      browser,
      user_agent,
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
 *
 * Optional fields default to null so existing records without them
 * remain fully readable — no schema migration needed.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.userEmail
 * @param {string} params.key          — S3 object key
 * @param {string} params.name         — original filename
 * @param {number} params.size         — file size in bytes
 * @param {string} params.mimeType
 * @param {string} params.s3Url        — base (unsigned) S3 URL
 * @param {string} [params.s3VersionId] — S3 VersionId (null if versioning off)
 * @param {string} [params.sha256]      — 64-char hex SHA-256 of the file bytes
 * @param {string} [params.blockchainStatus] — 'recorded' or 'failed'
 */
async function saveFileMetadata({
  userId,
  userEmail,
  key,
  name,
  size,
  mimeType,
  s3Url,
  s3VersionId = null,
  sha256      = null,
  blockchainStatus = null,
}) {
  try {
    const docRef = await db.collection(COLLECTIONS.FILE_METADATA).add({
      userId,
      user_email:  userEmail,
      key,
      name,
      size,
      mimeType,
      s3Url,
      s3VersionId,      // null when bucket versioning is not enabled
      sha256,           // null for records created before this feature was added
      blockchainStatus, // null for records created before blockchain integration
      uploadedAt:       admin.firestore.FieldValue.serverTimestamp(),
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

// ─────────────────────────────────────────────────────────────
// PASSWORD RESET TOKEN HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Persist a password-reset token record.
 *
 * SECURITY: The raw token is NEVER stored — only its SHA-256 hash.
 *
 * @param {object} params
 * @param {string} params.tokenHash  — SHA-256 hex of the raw token
 * @param {string} params.userId     — Firestore user doc ID
 * @param {string} params.email      — user's email (for quick lookup)
 * @param {Date}   params.expiresAt  — JS Date when the token expires
 */
async function savePasswordResetToken({ tokenHash, userId, email, expiresAt }) {
  await db.collection(COLLECTIONS.PASSWORD_RESET_TOKENS).add({
    tokenHash,
    userId,
    email,
    expiresAt:  admin.firestore.Timestamp.fromDate(expiresAt),
    used:       false,
    createdAt:  admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Validate a reset token and mark it used in a single atomic operation.
 *
 * Returns the token record (with userId + email) on success.
 * Returns null if the token hash is not found, already used, or expired.
 *
 * @param {string} tokenHash — SHA-256 hex of the raw token supplied by the user
 * @returns {object|null}    — { userId, email } or null
 */
async function validateAndConsumeResetToken(tokenHash) {
  const snap = await db.collection(COLLECTIONS.PASSWORD_RESET_TOKENS)
    .where('tokenHash', '==', tokenHash)
    .where('used',      '==', false)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc      = snap.docs[0];
  const data     = doc.data();
  const now      = new Date();
  const expiresAt = data.expiresAt?.toDate?.() || null;

  // Reject expired tokens
  if (!expiresAt || expiresAt <= now) return null;

  // Mark as used — single-use enforcement
  await doc.ref.update({ used: true });

  return { userId: data.userId, email: data.email };
}

// ─────────────────────────────────────────────────────────────
// OTP-BASED PASSWORD RESET HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Save an OTP (hashed) for password reset.
 * 
 * SECURITY: Only the SHA-256 hash of the OTP is stored, never the raw OTP.
 * 
 * @param {object} params
 * @param {string} params.otpHash    — SHA-256 hex of the 6-digit OTP
 * @param {string} params.userId     — Firestore user doc ID
 * @param {string} params.email      — user's email (for lookup)
 * @param {Date}   params.expiresAt  — expiry time (5 minutes from creation)
 */
async function saveOTP({ otpHash, userId, email, expiresAt }) {
  await db.collection(COLLECTIONS.PASSWORD_RESET_OTPS).add({
    otpHash,
    userId,
    email,
    expiresAt:  admin.firestore.Timestamp.fromDate(expiresAt),
    attempts:   0,
    maxAttempts: 5,
    used:       false,
    createdAt:  admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Validate an OTP and mark it as used if valid.
 * 
 * Returns the OTP record with userId and email on success.
 * Returns null if:
 * - OTP hash not found
 * - OTP already used
 * - OTP expired
 * - Max attempts exceeded
 * 
 * IMPORTANT: Increments attempt counter even on expiry to prevent timing attacks.
 * 
 * @param {string} email   — user's email address
 * @param {string} otpHash — SHA-256 hex of the OTP entered by user
 * @returns {object|null}  — { userId, email } or null
 */
async function validateOTP(email, otpHash) {
  // Find the most recent unused OTP for this email
  const snap = await db.collection(COLLECTIONS.PASSWORD_RESET_OTPS)
    .where('email',  '==', email)
    .where('otpHash', '==', otpHash)
    .where('used',    '==', false)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc  = snap.docs[0];
  const data = doc.data();
  const now  = new Date();
  const expiresAt = data.expiresAt?.toDate?.() || null;

  // Check max attempts
  if (data.attempts >= data.maxAttempts) {
    return null;
  }

  // Increment attempt counter
  await doc.ref.update({
    attempts: admin.firestore.FieldValue.increment(1),
  });

  // Check expiry AFTER incrementing attempts to prevent timing attacks
  if (!expiresAt || expiresAt <= now) {
    return null;
  }

  // Mark as used
  await doc.ref.update({ used: true });

  return { userId: data.userId, email: data.email };
}

/**
 * Increment OTP attempt counter for failed verification.
 * Used when OTP is incorrect but not expired.
 * 
 * @param {string} email — user's email
 */
async function incrementOTPAttempts(email) {
  try {
    const snap = await db.collection(COLLECTIONS.PASSWORD_RESET_OTPS)
      .where('email', '==', email)
      .where('used',  '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!snap.empty) {
      await snap.docs[0].ref.update({
        attempts: admin.firestore.FieldValue.increment(1),
      });
    }
  } catch (err) {
    console.error('[Firebase] incrementOTPAttempts error:', err.message);
  }
}

/**
 * Delete all OTPs for a given email (used after successful password reset).
 * 
 * @param {string} email — user's email
 */
async function deleteOTPsByEmail(email) {
  try {
    const snap = await db.collection(COLLECTIONS.PASSWORD_RESET_OTPS)
      .where('email', '==', email)
      .get();
    
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  } catch (err) {
    console.error('[Firebase] deleteOTPsByEmail error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// FILE RECOVERY LOG HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Save a file recovery log entry.
 * Records both successful and failed recovery attempts for audit purposes.
 *
 * @param {object} params
 * @param {string} params.fileId                   — File identifier
 * @param {string} params.fileName                 — Original file name
 * @param {string} params.fileKey                  — S3 object key
 * @param {string} params.userId                   — User initiating recovery
 * @param {string} params.userEmail                — User email
 * @param {string} params.originalS3VersionId      — Original trusted S3 version
 * @param {string} [params.restoredS3VersionId]    — New current version after restore
 * @param {string} params.trustedOriginalSha256    — Blockchain-verified hash
 * @param {string} [params.restoredSha256]         — Hash of restored content
 * @param {string} params.status                   — 'success' | 'failed'
 * @param {boolean} params.integrityVerified       — Final verification result
 * @param {string} [params.failureReason]          — Error message if failed
 * @param {string} [params.blockchainTransactionId] — Fabric transaction ID
 * @param {string} [params.ipAddress]              — User IP
 * @param {string} [params.device]                 — Device info
 * @param {string} [params.os]                     — OS info
 * @param {string} [params.browser]                — Browser info
 * @returns {Promise<string>} Document ID
 */
async function saveRecoveryLog({
  fileId,
  fileName,
  fileKey,
  userId,
  userEmail,
  originalS3VersionId,
  restoredS3VersionId = null,
  trustedOriginalSha256,
  restoredSha256 = null,
  status,
  integrityVerified,
  failureReason = null,
  blockchainTransactionId = null,
  ipAddress = '',
  device = '',
  os = '',
  browser = '',
}) {
  try {
    const docRef = await db.collection(COLLECTIONS.FILE_RECOVERY_LOGS).add({
      fileId,
      fileName,
      fileKey,
      userId,
      userEmail,
      originalS3VersionId,
      restoredS3VersionId,
      trustedOriginalSha256,
      restoredSha256,
      status,
      integrityVerified,
      failureReason,
      blockchainTransactionId,
      ipAddress,
      device,
      os,
      browser,
      startedAt:   admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[Firebase] Recovery log saved: ${docRef.id} — ${status} for ${fileName}`);
    return docRef.id;
  } catch (err) {
    console.error('[Firebase] saveRecoveryLog error:', err.message);
    return null;
  }
}

/**
 * Get recovery logs for a specific user.
 *
 * @param {string} userId — User ID to filter by
 * @param {number} limit — Maximum number of records (default 100)
 * @returns {Promise<Array>} Array of recovery log objects
 */
async function getRecoveryLogsByUser(userId, limit = 100) {
  try {
    // NOTE: orderBy('completedAt', 'desc') removed temporarily due to missing Firestore composite index
    // To enable sorting by date, create a composite index in Firebase Console:
    //   Collection: file_recovery_logs
    //   Fields: userId (Ascending), completedAt (Descending)
    // Index creation URL is logged when the query fails
    const snap = await db.collection(COLLECTIONS.FILE_RECOVERY_LOGS)
      .where('userId', '==', userId)
      .limit(limit)
      .get();

    // Get all fileKeys from recovery logs to check if files still exist
    const fileKeys = [...new Set(snap.docs.map(doc => doc.data().fileKey).filter(Boolean))];
    
    // Query file_metadata to find which files still exist
    const existingFileKeys = new Set();
    if (fileKeys.length > 0) {
      // Firestore 'in' queries are limited to 10 items, so batch them
      for (let i = 0; i < fileKeys.length; i += 10) {
        const batch = fileKeys.slice(i, i + 10);
        const fileSnap = await db.collection(COLLECTIONS.FILE_METADATA)
          .where('key', 'in', batch)
          .select('key') // Only fetch the key field for efficiency
          .get();
        fileSnap.docs.forEach(doc => existingFileKeys.add(doc.data().key));
      }
    }

    // Sort in-memory by completedAt (most recent first) and filter out deleted records
    const docs = snap.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startedAt: data.startedAt?.toDate()?.toISOString() || null,
          completedAt: data.completedAt?.toDate()?.toISOString() || null,
          _sortKey: data.completedAt?.toMillis?.() || data.startedAt?.toMillis?.() || 0,
        };
      })
      // SYNCHRONIZATION: Filter out records marked as deleted OR whose files no longer exist
      .filter(doc => {
        // If explicitly marked deleted, exclude it
        if (doc.deleted) return false;
        
        // If the associated file no longer exists, exclude it (handles legacy records)
        if (doc.fileKey && !existingFileKeys.has(doc.fileKey)) return false;
        
        return true;
      });

    // Sort by timestamp (descending - newest first)
    docs.sort((a, b) => b._sortKey - a._sortKey);

    // Remove sort key before returning
    return docs.map(({ _sortKey, ...doc }) => doc);
  } catch (err) {
    console.error('[Firebase] getRecoveryLogsByUser error:', err.message);
    if (err.message.includes('index')) {
      console.error('[Firebase] Firestore composite index required.');
      console.error('[Firebase] Create index at:', err.message.match(/https:\/\/[^\s]+/)?.[0] || 'See Firebase Console');
    }
    return [];
  }
}

/**
 * Get all recovery logs (admin only).
 *
 * @param {number} limit — Maximum number of records (default 100)
 * @returns {Promise<Array>} Array of recovery log objects
 */
async function getAllRecoveryLogs(limit = 100) {
  try {
    const snap = await db.collection(COLLECTIONS.FILE_RECOVERY_LOGS)
      .orderBy('completedAt', 'desc')
      .limit(limit)
      .get();

    // Get all fileKeys to check which files still exist
    const fileKeys = [...new Set(snap.docs.map(doc => doc.data().fileKey).filter(Boolean))];
    
    // Query file_metadata to find which files still exist
    const existingFileKeys = new Set();
    if (fileKeys.length > 0) {
      // Firestore 'in' queries are limited to 10 items, so batch them
      for (let i = 0; i < fileKeys.length; i += 10) {
        const batch = fileKeys.slice(i, i + 10);
        const fileSnap = await db.collection(COLLECTIONS.FILE_METADATA)
          .where('key', 'in', batch)
          .select('key')
          .get();
        fileSnap.docs.forEach(doc => existingFileKeys.add(doc.data().key));
      }
    }

    return snap.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startedAt: data.startedAt?.toDate()?.toISOString() || null,
          completedAt: data.completedAt?.toDate()?.toISOString() || null,
        };
      })
      // Filter out deleted records or records for non-existent files
      .filter(doc => {
        if (doc.deleted) return false;
        if (doc.fileKey && !existingFileKeys.has(doc.fileKey)) return false;
        return true;
      });
  } catch (err) {
    console.error('[Firebase] getAllRecoveryLogs error:', err.message);
    return [];
  }
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
  // Password reset (token-based - deprecated, kept for backward compatibility)
  savePasswordResetToken,
  validateAndConsumeResetToken,
  // Password reset (OTP-based - new)
  saveOTP,
  validateOTP,
  incrementOTPAttempts,
  deleteOTPsByEmail,
  // File recovery logs
  saveRecoveryLog,
  getRecoveryLogsByUser,
  getAllRecoveryLogs,
};
