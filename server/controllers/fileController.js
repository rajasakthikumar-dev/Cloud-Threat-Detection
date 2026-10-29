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
  getObjectVersion,
  restoreObjectVersion,
} = require('../config/aws');

const {
  saveFileMetadata,
  deleteFileMetadata,
  logActivity,
  db,
  COLLECTIONS,
  saveRecoveryLog,
  getRecoveryLogsByUser,
  getAllRecoveryLogs,
} = require('../config/firebase');

const { getClientInfo, formatClientInfo } = require('../utils/deviceParser');

const { submitFileIntegrityRecord, verifyFileIntegrity, getFileHistory, recordFileRecovery } = require('../config/fabricGateway');

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
    const fileDocId = snap.docs[0].id;

    // Verify authenticated user is the owner
    if (fileDoc.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own files.' });
    }

    // Remove from S3 and Firestore
    await deleteFromS3(key);
    await deleteFileMetadata(key);

    // SYNCHRONIZATION: Mark related recovery logs as deleted
    // Find all recovery logs for this file (by fileKey or fileId)
    try {
      const recoverySnap = await db.collection(COLLECTIONS.FILE_RECOVERY_LOGS)
        .where('fileKey', '==', key)
        .get();
      
      if (!recoverySnap.empty) {
        const batch = db.batch();
        recoverySnap.docs.forEach(doc => {
          // Soft delete: mark as deleted rather than removing the audit record
          batch.update(doc.ref, {
            deleted: true,
            deletedAt: admin.firestore.FieldValue.serverTimestamp(),
            deletedBy: req.user.id
          });
        });
        await batch.commit();
        console.log(`[fileController.deleteFile] Marked ${recoverySnap.size} recovery log(s) as deleted for file: ${key}`);
      }
    } catch (recoveryErr) {
      // Log error but don't fail the delete operation
      console.error('[fileController.deleteFile] Failed to update recovery logs:', recoveryErr.message);
    }

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

    // ── 8. Determine recovery eligibility ───────────────────
    // Recovery is available only when:
    // 1. Integrity mismatch detected (!v.match)
    // 2. Original S3 version metadata exists
    // 3. User is the file owner (already validated above)
    const recoveryEligible = !v.match && !!fileDoc.s3VersionId && !!fileDoc.sha256;

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
        recoveryEligible,                 // true if file can be recovered
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
    // NOTE: orderBy('timestamp', 'desc') removed to avoid missing Firestore composite index
    // Sorting is done in-memory instead
    const snap = await db.collection(COLLECTIONS.ACTIVITY_LOGS)
      .where('event_type', '==', 'integrity_failure')
      .limit(100) // Limit to recent 100 failures
      .get();

    const failures = snap.docs
      .map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          userId: d.userId,
          userEmail: d.user_email || d.userEmail,
          details: d.details,
          timestamp: d.timestamp?.toDate?.() ? d.timestamp.toDate().toISOString() : d.timestamp,
          _sortKey: d.timestamp?.toMillis?.() || 0,
          ipAddress: d.ip_address,
          device: d.device,
          os: d.os,
          browser: d.browser,
          metadata: d.metadata || {},
        };
      })
      // Sort in-memory by timestamp (descending - newest first)
      .sort((a, b) => b._sortKey - a._sortKey)
      // Remove sort key before returning
      .map(({ _sortKey, ...failure }) => failure);

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

// ─────────────────────────────────────────────────────────────
// RECOVER ORIGINAL FILE
// POST /api/files/:key/recover
// Blockchain-verified file recovery: restore original uploaded version
// ─────────────────────────────────────────────────────────────
async function recoverFile(req, res) {
  const key = decodeURIComponent(req.params.key);
  const clientInfo = getClientInfo(req);
  
  console.log('══════════════════════════════════════════════════════════════');
  console.log('[FILE RECOVERY] Starting recovery process for:', key);
  console.log('[FILE RECOVERY] User:', req.user.email, 'ID:', req.user.id);
  console.log('══════════════════════════════════════════════════════════════');
  
  try {
    // ── STEP 1: Verify ownership and get file metadata ──────
    const snap = await db.collection(COLLECTIONS.FILE_METADATA)
      .where('key', '==', key).limit(1).get();

    if (snap.empty) {
      console.log('[FILE RECOVERY] FAILED: File not found in Firestore');
      return res.status(404).json({ message: 'File not found.' });
    }

    const fileDoc = snap.docs[0].data();
    
    // Authorization: Only file owner can recover
    if (fileDoc.userId !== req.user.id) {
      console.log('[FILE RECOVERY] FAILED: User not authorized');
      return res.status(403).json({ message: 'You can only recover your own files.' });
    }

    console.log('[FILE RECOVERY] File metadata retrieved:', fileDoc.name);
    console.log('[FILE RECOVERY] Original S3 VersionId:', fileDoc.s3VersionId);
    console.log('[FILE RECOVERY] Trusted SHA-256:', fileDoc.sha256);

    // ── STEP 2: Validate blockchain record exists ────────────
    if (fileDoc.blockchainStatus !== 'recorded') {
      console.log('[FILE RECOVERY] FAILED: No blockchain record');
      return res.status(400).json({
        message: 'Cannot recover file: no blockchain integrity record found.',
        blockchainStatus: fileDoc.blockchainStatus || 'unknown',
      });
    }

    if (!fileDoc.s3VersionId || !fileDoc.sha256) {
      console.log('[FILE RECOVERY] FAILED: Missing version or hash metadata');
      return res.status(400).json({
        message: 'Cannot recover file: missing original version information.',
      });
    }

    // ── STEP 3: Verify current file has integrity mismatch ───
    console.log('[FILE RECOVERY] Step 3: Verifying current file integrity...');
    const { stream: currentStream } = await getObjectStream(key);
    const currentBuffer = await streamToBuffer(currentStream);
    const currentSha256 = crypto.createHash('sha256').update(currentBuffer).digest('hex');
    
    console.log('[FILE RECOVERY] Current file SHA-256:', currentSha256);
    console.log('[FILE RECOVERY] Trusted blockchain SHA-256:', fileDoc.sha256);

    // If current file matches trusted hash, no recovery needed
    if (currentSha256 === fileDoc.sha256) {
      console.log('[FILE RECOVERY] ABORTED: File already matches blockchain hash');
      return res.status(400).json({
        message: 'File recovery not needed: current file matches blockchain hash.',
        status: 'already_verified',
      });
    }

    console.log('[FILE RECOVERY] Integrity mismatch confirmed — recovery authorized');

    // ── STEP 4: Retrieve original S3 version ─────────────────
    console.log('[FILE RECOVERY] Step 4: Retrieving original S3 version...');
    let originalStream, originalContentType;
    
    try {
      const originalVersion = await getObjectVersion(key, fileDoc.s3VersionId);
      originalStream = originalVersion.stream;
      originalContentType = originalVersion.contentType;
      console.log('[FILE RECOVERY] Original version retrieved successfully');
    } catch (s3Error) {
      console.error('[FILE RECOVERY] FAILED: Cannot retrieve original S3 version:', s3Error.message);
      
      // Log failed recovery attempt
      await saveRecoveryLog({
        fileId: key.replace(/[^a-zA-Z0-9\-_.]/g, '_'),
        fileName: fileDoc.name,
        fileKey: key,
        userId: req.user.id,
        userEmail: req.user.email,
        originalS3VersionId: fileDoc.s3VersionId,
        trustedOriginalSha256: fileDoc.sha256,
        status: 'failed',
        integrityVerified: false,
        failureReason: `S3 version retrieval failed: ${s3Error.message}`,
        ipAddress: clientInfo.ip,
        device: clientInfo.device,
        os: clientInfo.os,
        browser: clientInfo.browser,
      });

      return res.status(500).json({
        message: 'Recovery failed: original version not accessible in S3.',
        error: s3Error.message,
      });
    }

    // ── STEP 5: Verify original version matches blockchain hash ─
    console.log('[FILE RECOVERY] Step 5: Verifying original version integrity...');
    const originalBuffer = await streamToBuffer(originalStream);
    const originalSha256 = crypto.createHash('sha256').update(originalBuffer).digest('hex');
    
    console.log('[FILE RECOVERY] Original version SHA-256:', originalSha256);

    if (originalSha256 !== fileDoc.sha256) {
      console.error('[FILE RECOVERY] FAILED: Original version hash mismatch!');
      console.error('[FILE RECOVERY] Expected:', fileDoc.sha256);
      console.error('[FILE RECOVERY] Got:', originalSha256);
      
      // Log failed recovery attempt
      await saveRecoveryLog({
        fileId: key.replace(/[^a-zA-Z0-9\-_.]/g, '_'),
        fileName: fileDoc.name,
        fileKey: key,
        userId: req.user.id,
        userEmail: req.user.email,
        originalS3VersionId: fileDoc.s3VersionId,
        trustedOriginalSha256: fileDoc.sha256,
        restoredSha256: originalSha256,
        status: 'failed',
        integrityVerified: false,
        failureReason: 'Original S3 version hash does not match blockchain record',
        ipAddress: clientInfo.ip,
        device: clientInfo.device,
        os: clientInfo.os,
        browser: clientInfo.browser,
      });

      return res.status(500).json({
        message: 'Recovery failed: original version does not match blockchain record.',
        error: 'Hash verification failed',
      });
    }

    console.log('[FILE RECOVERY] ✓ Original version verified against blockchain');

    // ── STEP 6: Restore original content as new current version ─
    console.log('[FILE RECOVERY] Step 6: Restoring verified content to S3...');
    let restoredVersionId;
    
    try {
      const restoreResult = await restoreObjectVersion(key, originalBuffer, originalContentType);
      restoredVersionId = restoreResult.versionId;
      console.log('[FILE RECOVERY] Content restored — new VersionId:', restoredVersionId);
    } catch (restoreError) {
      console.error('[FILE RECOVERY] FAILED: S3 restore operation failed:', restoreError.message);
      
      // Log failed recovery attempt
      await saveRecoveryLog({
        fileId: key.replace(/[^a-zA-Z0-9\-_.]/g, '_'),
        fileName: fileDoc.name,
        fileKey: key,
        userId: req.user.id,
        userEmail: req.user.email,
        originalS3VersionId: fileDoc.s3VersionId,
        trustedOriginalSha256: fileDoc.sha256,
        restoredSha256: originalSha256,
        status: 'failed',
        integrityVerified: true,
        failureReason: `S3 restore operation failed: ${restoreError.message}`,
        ipAddress: clientInfo.ip,
        device: clientInfo.device,
        os: clientInfo.os,
        browser: clientInfo.browser,
      });

      return res.status(500).json({
        message: 'Recovery failed: could not restore content to S3.',
        error: restoreError.message,
      });
    }

    // ── STEP 7: Verify restored content ──────────────────────
    console.log('[FILE RECOVERY] Step 7: Verifying restored content...');
    const { stream: restoredStream } = await getObjectStream(key);
    const restoredBuffer = await streamToBuffer(restoredStream);
    const restoredSha256 = crypto.createHash('sha256').update(restoredBuffer).digest('hex');
    
    console.log('[FILE RECOVERY] Restored file SHA-256:', restoredSha256);

    if (restoredSha256 !== fileDoc.sha256) {
      console.error('[FILE RECOVERY] FAILED: Post-restore verification failed!');
      console.error('[FILE RECOVERY] Expected:', fileDoc.sha256);
      console.error('[FILE RECOVERY] Got:', restoredSha256);
      
      // Log failed recovery attempt
      await saveRecoveryLog({
        fileId: key.replace(/[^a-zA-Z0-9\-_.]/g, '_'),
        fileName: fileDoc.name,
        fileKey: key,
        userId: req.user.id,
        userEmail: req.user.email,
        originalS3VersionId: fileDoc.s3VersionId,
        restoredS3VersionId: restoredVersionId,
        trustedOriginalSha256: fileDoc.sha256,
        restoredSha256: restoredSha256,
        status: 'failed',
        integrityVerified: false,
        failureReason: 'Post-restoration verification failed',
        ipAddress: clientInfo.ip,
        device: clientInfo.device,
        os: clientInfo.os,
        browser: clientInfo.browser,
      });

      return res.status(500).json({
        message: 'Recovery failed: restored content verification failed.',
        error: 'Post-restore hash mismatch',
      });
    }

    console.log('[FILE RECOVERY] ✓ Restored content verified');

    // ── STEP 8: Record recovery on blockchain ────────────────
    console.log('[FILE RECOVERY] Step 8: Recording recovery audit on blockchain...');
    const fileId = key.replace(/[^a-zA-Z0-9\-_.]/g, '_');
    let blockchainTxId = null;
    
    try {
      const recoveryAudit = await recordFileRecovery({
        fileId,
        fileName: fileDoc.name,
        userId: req.user.id,
        originalS3VersionId: fileDoc.s3VersionId,
        restoredS3VersionId: restoredVersionId || 'unknown',
        trustedSha256: fileDoc.sha256,
        restoredSha256: restoredSha256,
        recoveryReason: 'integrity_mismatch',
      });
      
      if (recoveryAudit.success) {
        blockchainTxId = recoveryAudit.transactionId;
        console.log('[FILE RECOVERY] ✓ Recovery recorded on blockchain:', blockchainTxId);
      } else {
        console.warn('[FILE RECOVERY] WARNING: Blockchain recording failed:', recoveryAudit.error);
        // Continue anyway — Firestore log is still created
      }
    } catch (blockchainError) {
      console.warn('[FILE RECOVERY] WARNING: Blockchain recording error:', blockchainError.message);
      // Continue anyway — Firestore log is still created
    }

    // ── STEP 9: Save recovery log to Firestore ───────────────
    console.log('[FILE RECOVERY] Step 9: Saving recovery log to Firestore...');
    await saveRecoveryLog({
      fileId,
      fileName: fileDoc.name,
      fileKey: key,
      userId: req.user.id,
      userEmail: req.user.email,
      originalS3VersionId: fileDoc.s3VersionId,
      restoredS3VersionId: restoredVersionId,
      trustedOriginalSha256: fileDoc.sha256,
      restoredSha256: restoredSha256,
      status: 'success',
      integrityVerified: true,
      blockchainTransactionId: blockchainTxId,
      ipAddress: clientInfo.ip,
      device: clientInfo.device,
      os: clientInfo.os,
      browser: clientInfo.browser,
    });

    // ── STEP 10: Log activity ─────────────────────────────────
    await logActivity({
      userId: req.user.id,
      userEmail: req.user.email,
      event_type: 'file_recovery_success',
      details: `Successfully recovered "${fileDoc.name}" to blockchain-verified original from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device: clientInfo.device,
      os: clientInfo.os,
      browser: clientInfo.browser,
      user_agent: clientInfo.userAgent,
      metadata: {
        key,
        fileId,
        originalS3VersionId: fileDoc.s3VersionId,
        restoredS3VersionId: restoredVersionId,
        trustedSha256: fileDoc.sha256,
        blockchainTransactionId: blockchainTxId,
      },
    });

    console.log('══════════════════════════════════════════════════════════════');
    console.log('[FILE RECOVERY] SUCCESS: Recovery completed');
    console.log('[FILE RECOVERY] File:', fileDoc.name);
    console.log('[FILE RECOVERY] Original VersionId:', fileDoc.s3VersionId);
    console.log('[FILE RECOVERY] Restored VersionId:', restoredVersionId);
    console.log('[FILE RECOVERY] Blockchain TxId:', blockchainTxId || 'not recorded');
    console.log('══════════════════════════════════════════════════════════════');

    return res.json({
      message: 'File recovered successfully. Integrity verification passed.',
      recovery: {
        fileName: fileDoc.name,
        originalS3VersionId: fileDoc.s3VersionId,
        restoredS3VersionId: restoredVersionId,
        trustedSha256: fileDoc.sha256,
        restoredSha256: restoredSha256,
        integrityVerified: true,
        blockchainRecorded: !!blockchainTxId,
        blockchainTransactionId: blockchainTxId,
      },
    });

  } catch (err) {
    console.error('══════════════════════════════════════════════════════════════');
    console.error('[FILE RECOVERY] UNEXPECTED ERROR:', err);
    console.error('[FILE RECOVERY] Stack:', err.stack);
    console.error('══════════════════════════════════════════════════════════════');
    
    // Log unexpected failure
    try {
      await logActivity({
        userId: req.user.id,
        userEmail: req.user.email,
        event_type: 'file_recovery_error',
        details: `File recovery error: ${err.message}`,
        ip_address: clientInfo.ip,
        metadata: { key, error: err.message },
      });
    } catch (logError) {
      console.error('[FILE RECOVERY] Failed to log error:', logError);
    }

    return res.status(500).json({ 
      message: 'File recovery failed due to unexpected error.',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal error',
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET RECOVERY HISTORY (USER)
// GET /api/files/recovery-history
// Returns recovery logs for the authenticated user
// ─────────────────────────────────────────────────────────────
async function getRecoveryHistory(req, res) {
  try {
    const logs = await getRecoveryLogsByUser(req.user.id, 50); // Limit to 50 most recent
    
    console.log(`[getRecoveryHistory] Retrieved ${logs.length} recovery logs for user ${req.user.email}`);

    return res.json({
      message: 'Recovery history retrieved successfully.',
      recoveries: logs,
    });
  } catch (err) {
    console.error('[fileController.getRecoveryHistory]', err.message);
    return res.status(500).json({
      message: 'Failed to retrieve recovery history.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE RECOVERY RECORD
// DELETE /api/files/recovery/:recordId
// Deletes a specific recovery record by its ID
// Also marks it as deleted and optionally deletes the associated file
// ─────────────────────────────────────────────────────────────
async function deleteRecoveryRecord(req, res) {
  try {
    const recordId = req.params.recordId;
    
    // Get the recovery record first to verify ownership and get fileKey
    const recordRef = db.collection(COLLECTIONS.FILE_RECOVERY_LOGS).doc(recordId);
    const recordDoc = await recordRef.get();
    
    if (!recordDoc.exists) {
      return res.status(404).json({ message: 'Recovery record not found.' });
    }
    
    const recordData = recordDoc.data();
    
    // Verify ownership
    if (recordData.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only delete your own recovery records.' });
    }
    
    // Mark the recovery record as deleted (soft delete for audit trail)
    await recordRef.update({
      deleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: req.user.id
    });
    
    console.log(`[fileController.deleteRecoveryRecord] Marked recovery record ${recordId} as deleted`);
    
    // Optionally delete the associated file if it still exists
    // This handles the case where the file exists but the user deletes from Recovered Files
    const fileKey = recordData.fileKey;
    if (fileKey) {
      try {
        const fileSnap = await db.collection(COLLECTIONS.FILE_METADATA)
          .where('key', '==', fileKey)
          .limit(1)
          .get();
        
        if (!fileSnap.empty) {
          const fileDoc = fileSnap.docs[0].data();
          
          // Only delete if user owns it
          if (fileDoc.userId === req.user.id) {
            await deleteFromS3(fileKey);
            await deleteFileMetadata(fileKey);
            
            // Mark ALL other recovery logs for this file as deleted too
            const otherRecoverySnap = await db.collection(COLLECTIONS.FILE_RECOVERY_LOGS)
              .where('fileKey', '==', fileKey)
              .get();
            
            if (!otherRecoverySnap.empty) {
              const batch = db.batch();
              otherRecoverySnap.docs.forEach(doc => {
                if (doc.id !== recordId) { // Don't update the one we already updated
                  batch.update(doc.ref, {
                    deleted: true,
                    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
                    deletedBy: req.user.id
                  });
                }
              });
              await batch.commit();
              console.log(`[fileController.deleteRecoveryRecord] Marked ${otherRecoverySnap.size - 1} related recovery logs as deleted`);
            }
            
            console.log(`[fileController.deleteRecoveryRecord] Also deleted associated file: ${fileKey}`);
          }
        }
      } catch (fileErr) {
        // File might already be deleted, that's okay
        console.log(`[fileController.deleteRecoveryRecord] File already deleted or inaccessible: ${fileErr.message}`);
      }
    }
    
    const clientInfo = getClientInfo(req);
    await logActivity({
      userId: req.user.id,
      userEmail: req.user.email,
      event_type: 'recovery_record_delete',
      details: `Deleted recovery record for ${recordData.fileName} from ${formatClientInfo(clientInfo)}`,
      ip_address: clientInfo.ip,
      device: clientInfo.device,
      os: clientInfo.os,
      browser: clientInfo.browser,
      user_agent: clientInfo.userAgent,
      metadata: { recordId, fileName: recordData.fileName, fileKey: recordData.fileKey },
    });
    
    return res.json({ 
      message: 'Recovery record deleted successfully.',
      fileAlsoDeleted: fileKey ? true : false
    });
  } catch (err) {
    console.error('[fileController.deleteRecoveryRecord]', err);
    return res.status(500).json({ message: 'Failed to delete recovery record.' });
  }
}

// ─────────────────────────────────────────────────────────────
// GET ALL RECOVERY HISTORY (ADMIN ONLY)
// GET /api/files/admin/recovery-history
// Returns all recovery logs across all users for admin monitoring
// ─────────────────────────────────────────────────────────────
async function getAdminRecoveryHistory(req, res) {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    console.log('[getAdminRecoveryHistory] Called by admin:', req.user.email);

    const logs = await getAllRecoveryLogs(100); // Limit to 100 most recent
    
    console.log(`[getAdminRecoveryHistory] Retrieved ${logs.length} total recovery logs`);

    // Calculate statistics
    const successfulRecoveries = logs.filter(log => log.status === 'success').length;
    const failedRecoveries = logs.filter(log => log.status === 'failed').length;
    const blockchainRecorded = logs.filter(log => log.blockchainTransactionId).length;
    const uniqueUsers = new Set(logs.map(log => log.userId)).size;
    const uniqueFiles = new Set(logs.map(log => log.fileKey)).size;

    const stats = {
      totalRecoveries: logs.length,
      successfulRecoveries,
      failedRecoveries,
      blockchainRecorded,
      uniqueUsers,
      uniqueFiles,
    };

    console.log('[getAdminRecoveryHistory] Stats:', stats);

    return res.json({
      message: 'Admin recovery history retrieved successfully.',
      recoveries: logs,
      stats,
    });
  } catch (err) {
    console.error('[fileController.getAdminRecoveryHistory]', err.message);
    return res.status(500).json({
      message: 'Failed to retrieve admin recovery history.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
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
  recoverFile,
  getRecoveryHistory,
  deleteRecoveryRecord,
  getAdminRecoveryHistory,
};
