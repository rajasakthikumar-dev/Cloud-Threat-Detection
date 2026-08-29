/**
 * config/aws.js
 * --------------
 * AWS S3 client and helper functions.
 *
 * Requires these environment variables in server/.env:
 *   AWS_REGION            e.g. us-east-1
 *   AWS_ACCESS_KEY_ID     your IAM key
 *   AWS_SECRET_ACCESS_KEY your IAM secret
 *   AWS_S3_BUCKET         your bucket name
 */

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 }   = require('uuid');
const path             = require('path');

// ─────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Build a unique S3 object key for an uploaded file.
 * Format: uploads/<userId>/<uuid>-<originalname>
 */
function buildKey(userId, originalName) {
  const ext  = path.extname(originalName);
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `uploads/${userId}/${uuidv4()}-${base}${ext}`;
}

// ─────────────────────────────────────────────────────────────
// OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Upload a file buffer to S3.
 *
 * @param {Buffer} buffer       — file content
 * @param {string} userId       — owner user ID (used in key prefix)
 * @param {string} originalName — original file name
 * @param {string} mimeType     — MIME type
 *
 * @returns {{ key, url, size }}
 */
async function uploadToS3(buffer, userId, originalName, mimeType) {
  const key = buildKey(userId, originalName);

  await s3Client.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: mimeType || 'application/octet-stream',
    // Files are private — access only via pre-signed URLs
    ACL: 'private',
    Metadata: {
      'uploaded-by': String(userId),
      'original-name': originalName,
    },
  }));

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return { key, url, size: buffer.length };
}

/**
 * Generate a short-lived pre-signed download / preview URL.
 *
 * @param {string} key         — S3 object key
 * @param {number} expiresIn   — seconds until expiry (default 15 min)
 * @param {string} disposition — 'attachment' | 'inline'
 * @param {string} [fileName]  — optional filename for content disposition header
 *
 * @returns {string} signed URL
 */
async function getDownloadUrl(key, expiresIn = 900, disposition = null, fileName = null) {
  const params = { Bucket: BUCKET, Key: key };
  if (disposition) {
    params.ResponseContentDisposition = fileName
      ? `${disposition}; filename="${encodeURIComponent(fileName)}"`
      : disposition;
  }
  const command = new GetObjectCommand(params);
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get S3 object as a readable stream.
 *
 * @param {string} key — S3 object key
 * @returns {Promise<{ stream, contentType, contentLength }>}
 */
async function getObjectStream(key) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3Client.send(command);
  return {
    stream:        response.Body,
    contentType:   response.ContentType,
    contentLength: response.ContentLength,
  };
}

/**
 * Permanently delete an object from S3.
 *
 * @param {string} key — S3 object key
 */
async function deleteFromS3(key) {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * List all objects under a given prefix (user folder).
 *
 * @param {string} prefix — e.g. "uploads/<userId>/"
 * @returns {Array<{ key, size, lastModified }>}
 */
async function listUserFiles(prefix) {
  const response = await s3Client.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
  }));

  return (response.Contents || []).map(obj => ({
    key:          obj.Key,
    size:         obj.Size,
    lastModified: obj.LastModified,
    name:         obj.Key.split('/').pop(),
  }));
}

/**
 * Check if an object exists in S3 without downloading it.
 *
 * @param {string} key
 * @returns {boolean}
 */
async function objectExists(key) {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  s3Client,
  uploadToS3,
  getDownloadUrl,
  getObjectStream,
  deleteFromS3,
  listUserFiles,
  objectExists,
  BUCKET,
};

