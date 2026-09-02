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

const { getClientIp } = require('../utils/ipExtractor');

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

    // Upload buffer to S3 (isolated in uploads/<userId>/ prefix)
    const { key, url } = await uploadToS3(buffer, userId, originalname, mimetype);

    // Persist metadata in Firestore
    const metaId = await saveFileMetadata({
      userId,
      userEmail,
      key,
      name:     originalname,
      size,
      mimeType: mimetype,
      s3Url:    url,
    });

    // Log the event
    const clientIp = getClientIp(req);
    await logActivity({
      userId,
      userEmail,
      event_type: 'file_upload',
      details:    `Uploaded "${originalname}" (${(size / 1024).toFixed(1)} KB) to S3`,
      ip_address: clientIp,
      metadata:   { key, size },
    });

    return res.status(201).json({
      message: 'File uploaded successfully.',
      file: { id: metaId, key, name: originalname, size, mimeType: mimetype, url },
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

    const clientIp = getClientIp(req);
    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'file_download',
      details:    `Download link generated for "${fileDoc.name}"`,
      ip_address: clientIp,
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

    const clientIp = getClientIp(req);
    await logActivity({
      userId:     req.user.id,
      userEmail:  req.user.email,
      event_type: 'file_delete',
      details:    `Deleted file "${fileDoc.name}" (key: ${key})`,
      ip_address: clientIp,
      metadata:   { key, name: fileDoc.name },
    });

    return res.json({ message: 'File deleted successfully.' });
  } catch (err) {
    console.error('[fileController.deleteFile]', err);
    return res.status(500).json({ message: 'Delete failed.' });
  }
}

module.exports = {
  uploadFile,
  getFiles,
  previewFile,
  getFileContent,
  downloadFile,
  deleteFile,
};
