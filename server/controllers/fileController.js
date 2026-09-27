/**
 * controllers/fileController.js
 * --------------------------------
 * AWS S3 file operations: upload, list, preview, download (signed URL), content stream, delete.
 * File metadata (name, size, key, owner) is persisted in Firebase Firestore.
 *
 * PRIVACY MODEL (Google Drive Architecture):
 * - Every uploaded file belongs exclusively to the user who uploaded it (req.user.id).
 * - User A sees, previews, downloads, and deletes ONLY User A's files.
 * - User B sees, previews, downloads, and deletes ONLY User B's files.
 * - Admin's "My Files" displays ONLY Admin's own files.
 * - Admin CANNOT view, preview, download, or delete other users' private files.
 * - All ownership checks are enforced on the backend via req.user.id.
 */

const {
  uploadToS3,
  getDownloadUrl,
  getObjectStream,
  deleteFromS3,
  listUserFiles,
} = require('../config/aws');

const {
  saveFileMetadata,
  deleteFileMetadata,
  logActivity,
  db,
  COLLECTIONS,
} = require('../config/firebase');

const { getClientInfo, formatClientInfo } = require('../utils/deviceParser');

const { submitFileIntegrityRecord, verifyFileIntegrity, getFileHistory } = require('../config/fabricGateway');

// Node built-in — no package install needed.
// Already used by authController for password-reset token hashing.
const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────
// UPLOAD
// POST /api/files/upload
// Expects multipart/form-data with a field named 'file'
// ─────────────────────────────────────────────────────────────
async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided. Use field name "file".' });
    }

    const { originalname, buffer, mimetype, size } = req.file;
    const userId    = req.user.id;
    const userEmail = req.user.email;

    // Compute SHA-256 from the exact file buffer received by multer.
    // Done before the S3 upload so we hash the actual bytes being stored.
    // Node built-in crypto — no external package required.
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    // sha256 is always exactly 64 lowercase hex characters.

    // Upload buffer to S3 (isolated in uploads/<userId>/ prefix)
    // versionId is the S3 VersionId when bucket versioning is enabled.
    const { key, url, versionId } = await uploadToS3(buffer, userId, originalname, mimetype);

    // Record file integrity on blockchain (after S3 success, before Firestore)
    let blockchainStatus = 'failed';
    let blockchainError = null;
    
    try {
      // Create unique fileId using key (which includes userId and filename)
      const fileId = key.replace(/[^a-zA-Z0-9\-_.]/g, '_'); // Sanitize for blockchain
      
      const blockchainResult = await submitFileIntegrityRecord({
        fileId,
        fileName: originalname,
        ownerId: userId,
        s3Key: key,
        s3VersionId: versionId || 'no-version', // Handle case where versioning is disabled
        sha256,
      });
      
      if (blockchainResult.success) {
        blockchainStatus = 'recorded';
        console.log('[fileController.uploadFile] Blockchain record created:', blockchainResult.transactionId);
      } else {
        blockchainError = blockchainResult.error;
        console.warn('[fileController.uploadFile] Blockchain recording failed:', blockchainResult.error);
      }
    } catch (fabricError) {
      blockchainError = fabricError.message;
      console.warn('[fileController.uploadFile] Blockchain recording error:', fabricError.message);
    }

    // Persist metadata in Firestore — includes s3VersionId and sha256 so
    // each upload is fully identified by content hash and storage version.
    const metaId = await saveFileMetadata({
      userId,
      userEmail,
      key,
      name:        originalname,
      size,
      mimeType:    mimetype,
      s3Url:       url,
      s3VersionId: versionId,   // null when versioning not enabled on bucket
      sha256,                   // 64-char hex digest of the exact file bytes
      blockchainStatus,         // 'recorded' or 'failed'
    });

    // Log the event
    const clientInfo = getClientInfo(req);
    await logActivity({
      userId,
      userEmail,
      event_type: 'file_upload',
      details:    `Uploaded "${originalname}" (${(size / 1024).toFixed(1)} KB) from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device:     clientInfo.device,
      os:         clientInfo.os,
      browser:    clientInfo.browser,
      user_agent: clientInfo.userAgent,
      metadata:   { key, size },
    });

    return res.status(201).json({
      message: 'File uploaded successfully.',
      file: { 
        id: metaId, 
        key, 
        name: originalname, 
        size, 
        mimeType: mimetype, 
        url, 
        s3VersionId: versionId, 
        sha256,
        blockchainStatus, // 'recorded' or 'failed'
      },
      // Include blockchain error in development only
      ...(process.env.NODE_ENV === 'development' && blockchainError && {
        blockchainError
      })
    });
  } catch (err) {
    console.error('[fileController.uploadFile]', err);
    return res.status(500).json({ message: 'Upload failed. Please try again.' });
  }
}

// ─────────────────────────────────────────────────────────────
// LIST FILES
// GET /api/files
// Strict Google Drive ownership: Every user (including Admin)
// sees ONLY files they own.
// ─────────────────────────────────────────────────────────────
async function getFiles(req, res) {
  try {
    // Strictly scope query by authenticated user ID for ALL roles (including admin).
    // Single-field index on 'userId' is built-in in Firestore.
    // In-memory sorting eliminates missing composite index errors.
    const snap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('userId', '==', req.user.id)
      .get();

    const files = snap.docs
      .map(doc => {
        const d = doc.data();
        let rawDate = 0;
        if (d.uploadedAt?.toDate) {
          rawDate = d.uploadedAt.toDate().getTime();
        } else if (d.uploadedAt) {
          rawDate = new Date(d.uploadedAt).getTime() || 0;
        }

        return {
          id:         doc.id,
          key:        d.key,
          name:       d.name,
          size:       d.size,
          mimeType:   d.mimeType,
          uploadedBy: d.user_email || d.userEmail || req.user.email,
          uploadedAt: d.uploadedAt?.toDate?.() ? d.uploadedAt.toDate().toISOString() : (d.uploadedAt || null),
          _timestamp: rawDate,
          // Include integrity fields for verification
          s3VersionId: d.s3VersionId || null,
          sha256: d.sha256 || null,
          blockchainStatus: d.blockchainStatus || null,
        };
      })
      .sort((a, b) => b._timestamp - a._timestamp)
      .map(({ _timestamp, ...f }) => f);

    return res.json({ files });
  } catch (err) {
    console.error('[fileController.getFiles]', err.message);
    return res.status(500).json({
      message: 'Failed to retrieve files.',
      detail:  process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// PREVIEW (pre-signed URL with inline disposition)
// GET /api/files/preview/:key
// ─────────────────────────────────────────────────────────────
async function previewFile(req, res) {
  try {
    const key = decodeURIComponent(req.params.key);

    // Strict backend ownership verification
    const snap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('key', '==', key).limit(1).get();

    if (snap.empty) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const fileDoc = snap.docs[0].data();

    // Verify authenticated user is the owner
    if (fileDoc.userId !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to preview this file.' });
    }

    // Generate pre-signed URL with inline disposition for in-browser rendering
    const url = await getDownloadUrl(key, 900, 'inline', fileDoc.name);

    return res.json({
      url,
      name:     fileDoc.name,
      mimeType: fileDoc.mimeType,
      size:     fileDoc.size,
      expiresIn: 900,
    });
  } catch (err) {
    console.error('[fileController.previewFile]', err);
    return res.status(500).json({ message: 'Failed to generate preview URL.' });
  }
}

// ─────────────────────────────────────────────────────────────
// GET FILE CONTENT (stream text/csv/json/code files directly)
// GET /api/files/content/:key
// ─────────────────────────────────────────────────────────────
async function getFileContent(req, res) {
  try {
    const key = decodeURIComponent(req.params.key);

    // Strict backend ownership verification
    const snap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('key', '==', key).limit(1).get();

    if (snap.empty) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const fileDoc = snap.docs[0].data();

    // Verify authenticated user is the owner
    if (fileDoc.userId !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to view this file content.' });
    }

    const { stream, contentType } = await getObjectStream(key);

    res.setHeader('Content-Type', contentType || fileDoc.mimeType || 'text/plain');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileDoc.name)}"`);

    stream.pipe(res);
  } catch (err) {
    console.error('[fileController.getFileContent]', err);
    return res.status(500).json({ message: 'Failed to retrieve file content.' });
  }
}

// ─────────────────────────────────────────────────────────────
// DOWNLOAD (pre-signed URL with attachment disposition)
// GET /api/files/download/:key
// ─────────────────────────────────────────────────────────────
async function downloadFile(req, res) {
  try {
    const key = decodeURIComponent(req.params.key);

    // Strict backend ownership verification
    const snap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('key', '==', key).limit(1).get();

    if (snap.empty) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const fileDoc = snap.docs[0].data();

    // Verify authenticated user is the owner
    if (fileDoc.userId !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to download this file.' });
    }

    // Generate a 15-minute pre-signed download URL with attachment disposition
    const url = await getDownloadUrl(key, 900, 'attachment', fileDoc.name);

    const clientInfo = getClientInfo(req);
    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'file_download',
      details:    `Download link generated for "${fileDoc.name}" from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device:     clientInfo.device,
      os:         clientInfo.os,
      browser:    clientInfo.browser,
      user_agent: clientInfo.userAgent,
      metadata:   { key, size: fileDoc.size },
    });

    return res.json({ url, name: fileDoc.name, expiresIn: 900 });
  } catch (err) {
    console.error('[fileController.downloadFile]', err);
    return res.status(500).json({ message: 'Failed to generate download URL.' });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE
// DELETE /api/files/:key
// ─────────────────────────────────────────────────────────────
async function deleteFile(req, res) {
  try {
    const key = decodeURIComponent(req.params.key);

    // Strict backend ownership verification
    const snap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('key', '==', key).limit(1).get();

    if (snap.empty) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const fileDoc = snap.docs[0].data();

    // Verify authenticated user is the owner
    if (fileDoc.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own files.' });
    }

    // Remove from S3 and Firestore
    await deleteFromS3(key);
    await deleteFileMetadata(key);

    const clientInfo = getClientInfo(req);
    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'file_delete',
      details:    `Deleted file "${fileDoc.name}" from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device:     clientInfo.device,
      os:         clientInfo.os,
      browser:    clientInfo.browser,
      user_agent: clientInfo.userAgent,
      metadata:   { key, name: fileDoc.name },
    });

    return res.json({ message: 'File deleted successfully.' });
  } catch (err) {
    console.error('[fileController.deleteFile]', err);
    return res.status(500).json({ message: 'Delete failed.' });
  }
}

// ─────────────────────────────────────────────────────────────
// VERIFY FILE INTEGRITY
// POST /api/files/verify/:key
// Compare current S3 file hash against the blockchain record.
// Completely Promise-based — no nested stream.on() callbacks —
// so the outer try/catch is the single error boundary and a
// double-response is impossible.
// ─────────────────────────────────────────────────────────────

/**
 * Read an S3 stream into a Buffer, returning a Promise.
 * Rejects on stream error so the caller's try/catch handles it.
 */
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data',  chunk => chunks.push(chunk));
    stream.on('end',   ()    => resolve(Buffer.concat(chunks)));
    stream.on('error', err   => reject(err));
  });
}

async function verifyFileIntegrityEndpoint(req, res) {
  try {
    const key = decodeURIComponent(req.params.key);

    // ── 1. Ownership + existence check via Firestore ────────
    const snap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('key', '==', key).limit(1).get();

    if (snap.empty) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const fileDoc = snap.docs[0].data();

    // Authorization: File owner OR admin can verify
    const isOwner = fileDoc.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You do not have access to verify this file.' });
    }

    // ── 2. Guard: file must have a blockchain record ────────
    if (fileDoc.blockchainStatus !== 'recorded') {
      return res.status(400).json({
        message: 'File integrity verification unavailable. File was not recorded on blockchain.',
        blockchainStatus: fileDoc.blockchainStatus || 'unknown',
      });
    }

    // ── 3. Stream current S3 content and hash it ───────────
    const { stream } = await getObjectStream(key);
    const buffer       = await streamToBuffer(stream);          // awaitable — no nested callbacks
    const currentSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // ── 4. Derive fileId (identical logic used during upload) ─
    const fileId = key.replace(/[^a-zA-Z0-9\-_.]/g, '_');

    // ── 5. Call VerifyFileIntegrity on the blockchain ───────
    const verificationResult = await verifyFileIntegrity(
      fileId,
      fileDoc.s3VersionId || 'no-version',
      currentSha256
    );

    if (!verificationResult.success) {
      return res.status(500).json({
        message: 'Blockchain verification failed.',
        error:   verificationResult.error,
      });
    }

    const v = verificationResult.verification;

    // ── 6. Log integrity failure if hash mismatch detected ───
    if (!v.match) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('[INTEGRITY FAILURE DETECTED] File:', fileDoc.name);
      console.log('[INTEGRITY FAILURE] User:', req.user.email, 'ID:', req.user.id);
      console.log('[INTEGRITY FAILURE] Stored hash:', v.storedSha256);
      console.log('[INTEGRITY FAILURE] Current hash:', currentSha256);
      console.log('═══════════════════════════════════════════════════════');
      
      const clientInfo = getClientInfo(req);
      try {
        console.log('[INTEGRITY FAILURE] Attempting to log to activity_logs...');
        await logActivity({
          userId:     req.user.id,
          userEmail:  req.user.email,
          event_type: 'integrity_failure',
          details:    `Integrity verification FAILED for "${fileDoc.name}" — Hash mismatch detected from ${formatClientInfo(clientInfo)}`,
          ip_address: clientInfo.ip,
          device:     clientInfo.device,
          os:         clientInfo.os,
          browser:    clientInfo.browser,
          user_agent: clientInfo.userAgent,
          metadata:   {
            key:               key,
            fileName:          fileDoc.name,
            fileId:            v.fileId,
            storedSha256:      v.storedSha256,
            currentSha256:     currentSha256,
            storedVersionId:   v.s3VersionId,
            currentVersionId:  fileDoc.s3VersionId || 'unknown',
            verificationStatus: v.status,
            blockchainTimestamp: v.timestamp,
          },
        });
        console.log('[INTEGRITY FAILURE] Successfully logged to activity_logs');
        
        // Verify the log was actually written by querying it back
        const { db, COLLECTIONS } = require('../config/firebase');
        const verifySnap = await db.collection(COLLECTIONS.ACTIVITY_LOGS)
          .where('event_type', '==', 'integrity_failure')
          .where('userId', '==', req.user.id)
          .limit(5)
          .get();
        
        if (!verifySnap.empty) {
          console.log('[INTEGRITY FAILURE] Verified: Found', verifySnap.size, 'integrity_failure log(s) for user');
        } else {
          console.error('[INTEGRITY FAILURE] WARNING: Log write appeared successful but query found no records!');
        }
      } catch (logErr) {
        console.error('[INTEGRITY FAILURE] Failed to log activity:', logErr);
        console.error('[INTEGRITY FAILURE] Error details:', logErr.message);
        console.error('[INTEGRITY FAILURE] Error stack:', logErr.stack);
      }
    } else {
      // ── 7. Log successful verification ─────────────────────
      console.log('[INTEGRITY SUCCESS] File:', fileDoc.name, 'User:', req.user.email);
      console.log('[INTEGRITY SUCCESS] Hash match confirmed');
      
      const clientInfo = getClientInfo(req);
      try {
        await logActivity({
          userId:     req.user.id,
          userEmail:  req.user.email,
          event_type: 'integrity_verified',
          details:    `Integrity verification SUCCEEDED for "${fileDoc.name}" — File integrity confirmed from ${formatClientInfo(clientInfo)}`,
          ip_address: clientInfo.ip,
          device:     clientInfo.device,
          os:         clientInfo.os,
          browser:    clientInfo.browser,
          user_agent: clientInfo.userAgent,
          metadata:   {
            key:               key,
            fileName:          fileDoc.name,
            fileId:            v.fileId,
            sha256:            v.storedSha256,
            s3VersionId:       v.s3VersionId,
            verificationStatus: v.status,
            blockchainTimestamp: v.timestamp,
          },
        });
        console.log('[INTEGRITY SUCCESS] Successfully logged to activity_logs');
      } catch (logErr) {
        console.error('[INTEGRITY SUCCESS] Failed to log activity:', logErr);
      }
    }

    return res.json({
      message: 'File integrity verification completed.',
      verification: {
        status:        v.status,          // 'INTEGRITY_VERIFIED' | 'INTEGRITY_ALERT'
        match:         v.match,           // true | false
        fileId:        v.fileId,
        fileName:      v.fileName,
        s3VersionId:   v.s3VersionId,
        currentSha256,                    // hash re-computed from live S3 bytes
        storedSha256:  v.storedSha256,    // hash recorded on blockchain at upload time
        timestamp:     v.timestamp,       // blockchain record timestamp
      },
    });

  } catch (err) {
    console.error('[fileController.verifyFileIntegrityEndpoint]', err);
    return res.status(500).json({ message: 'Integrity verification failed.' });
  }
}

// ─────────────────────────────────────────────────────────────
// GET ALL BLOCKCHAIN-PROTECTED FILES (ADMIN ONLY)
// GET /api/files/admin/blockchain
// Returns all files with blockchain integrity records across all users
// For admin monitoring dashboard
// ─────────────────────────────────────────────────────────────
async function getAdminBlockchainFiles(req, res) {
  try {
    // Verify admin role (middleware should handle this, but double-check)
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    console.log('[getAdminBlockchainFiles] Called by admin:', req.user.email);

    // Query all files with blockchain status 'recorded'
    // No userId filter - admin sees all protected files
    const snap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('blockchainStatus', '==', 'recorded')
      .get();
    
    console.log('[getAdminBlockchainFiles] Found', snap.size, 'blockchain-protected files');

    const files = snap.docs
      .map(doc => {
        const d = doc.data();
        let rawDate = 0;
        if (d.uploadedAt?.toDate) {
          rawDate = d.uploadedAt.toDate().getTime();
        } else if (d.uploadedAt) {
          rawDate = new Date(d.uploadedAt).getTime() || 0;
        }

        return {
          id:         doc.id,
          key:        d.key,
          name:       d.name,
          size:       d.size,
          mimeType:   d.mimeType,
          uploadedBy: d.user_email || d.userEmail || 'Unknown',
          userId:     d.userId,
          uploadedAt: d.uploadedAt?.toDate?.() ? d.uploadedAt.toDate().toISOString() : (d.uploadedAt || null),
          _timestamp: rawDate,
          // Blockchain integrity fields
          s3VersionId: d.s3VersionId || null,
          sha256: d.sha256 || null,
          blockchainStatus: d.blockchainStatus || null,
        };
      })
      .sort((a, b) => b._timestamp - a._timestamp)
      .map(({ _timestamp, ...f }) => f);

    // Calculate statistics including verified files and integrity failures
    
    // Count UNIQUE verified files (not verification events)
    const verifiedEventsSnap = await db.collection(COLLECTIONS.ACTIVITY_LOGS)
      .where('event_type', '==', 'integrity_verified')
      .get();
    
    const verifiedFileKeys = new Set();
    verifiedEventsSnap.docs.forEach(doc => {
      const event = doc.data();
      if (event.metadata && event.metadata.key) {
        verifiedFileKeys.add(event.metadata.key);
      } else if (event.metadata && event.metadata.fileName) {
        verifiedFileKeys.add(event.metadata.fileName);
      }
    });
    
    console.log('[getAdminBlockchainFiles] Found', verifiedFileKeys.size, 'unique verified files (from', verifiedEventsSnap.size, 'verification events)');
    
    // Count UNIQUE failed files (not failure events)
    const integrityFailuresSnap = await db.collection(COLLECTIONS.ACTIVITY_LOGS)
      .where('event_type', '==', 'integrity_failure')
      .get();
    
    const failedFileKeys = new Set();
    integrityFailuresSnap.docs.forEach(doc => {
      const event = doc.data();
      if (event.metadata && event.metadata.key) {
        failedFileKeys.add(event.metadata.key);
      } else if (event.metadata && event.metadata.fileName) {
        failedFileKeys.add(event.metadata.fileName);
      }
    });
    
    console.log('[getAdminBlockchainFiles] Found', failedFileKeys.size, 'unique failed files (from', integrityFailuresSnap.size, 'failure events)');

    const stats = {
      totalProtected: files.length,
      blockchainRecorded: files.length, // All files in this result are recorded
      uniqueUsers: new Set(files.map(f => f.userId)).size,
      verifiedFiles: verifiedFileKeys.size, // Count unique verified files
      integrityFailures: failedFileKeys.size, // Count unique failed files
    };
    
    console.log('[getAdminBlockchainFiles] Returning stats:', stats);

    return res.json({ files, stats });
  } catch (err) {
    console.error('[fileController.getAdminBlockchainFiles]', err.message);
    return res.status(500).json({
      message: 'Failed to retrieve blockchain-protected files.',
      detail:  process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET INTEGRITY FAILURES (ADMIN ONLY)
// GET /api/files/admin/integrity-failures
// Returns all integrity failure events from activity logs
// ─────────────────────────────────────────────────────────────
async function getIntegrityFailures(req, res) {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    // Query all integrity failure events
    const snap = await db.collection(COLLECTIONS.ACTIVITY_LOGS)
      .where('event_type', '==', 'integrity_failure')
      .orderBy('timestamp', 'desc')
      .limit(100) // Limit to recent 100 failures
      .get();

    const failures = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        userId: d.userId,
        userEmail: d.user_email || d.userEmail,
        details: d.details,
        timestamp: d.timestamp?.toDate?.() ? d.timestamp.toDate().toISOString() : d.timestamp,
        ipAddress: d.ip_address,
        device: d.device,
        os: d.os,
        browser: d.browser,
        metadata: d.metadata || {},
      };
    });

    return res.json({ failures });
  } catch (err) {
    console.error('[fileController.getIntegrityFailures]', err.message);
    return res.status(500).json({
      message: 'Failed to retrieve integrity failures.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET FILE HISTORY
// GET /api/files/history/:key  
// Retrieve all versions of a file from blockchain
// ─────────────────────────────────────────────────────────────
async function getFileHistoryEndpoint(req, res) {
  try {
    const key = decodeURIComponent(req.params.key);
    
    // Get file metadata to check ownership
    const snap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('key', '==', key).limit(1).get();

    if (snap.empty) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const fileDoc = snap.docs[0].data();
    
    // Authorization: File owner OR admin can view history
    const isOwner = fileDoc.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You do not have access to view this file history.' });
    }

    // Create fileId from key (same logic as upload)
    const fileId = key.replace(/[^a-zA-Z0-9\-_.]/g, '_');
    
    // Get blockchain history
    const historyResult = await getFileHistory(fileId);

    if (historyResult.success) {
      return res.json({
        message: 'File history retrieved successfully.',
        fileId,
        fileName: fileDoc.name,
        currentVersion: {
          s3VersionId: fileDoc.s3VersionId,
          sha256: fileDoc.sha256,
          blockchainStatus: fileDoc.blockchainStatus,
        },
        history: historyResult.history
      });
    } else {
      return res.status(500).json({ 
        message: 'Failed to retrieve file history from blockchain.',
        error: historyResult.error 
      });
    }
    
  } catch (err) {
    console.error('[fileController.getFileHistoryEndpoint]', err);
    return res.status(500).json({ message: 'Failed to retrieve file history.' });
  }
}

module.exports = {
  uploadFile,
  getFiles,
  previewFile,
  getFileContent,
  downloadFile,
  deleteFile,
  verifyFileIntegrityEndpoint,
  getFileHistoryEndpoint,
  getAdminBlockchainFiles,
  getIntegrityFailures,
};
