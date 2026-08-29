/**
 * client/src/services/fileService.js
 * ------------------------------------
 * File management service layer — AWS S3 operations via backend.
 *
 * All file I/O goes through the Node.js backend which:
 *   - Streams uploads to AWS S3
 *   - Generates pre-signed download URLs
 *   - Logs every action to Firebase
 *
 * Pages import named functions from here instead of calling
 * api.js directly so upload progress tracking stays centralised.
 */

import api from './api';

// ─────────────────────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────────────────────

/**
 * Upload a single File object to AWS S3 via the backend.
 *
 * @param {File}     file             — browser File object
 * @param {Function} onProgress       — optional (percentComplete: number) => void
 * @returns {object} uploaded file metadata { id, key, name, size, url }
 */
export async function uploadFile(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        const percent = Math.round((event.loaded * 100) / event.total);
        onProgress(percent);
      }
    },
  });

  return response.data.file;
}

/**
 * Upload multiple files sequentially, calling onProgress for each.
 *
 * @param {File[]}   files
 * @param {Function} onFileProgress — (fileIndex, percent) => void
 * @param {Function} onFileComplete — (fileIndex, metadata) => void
 * @returns {object[]} array of uploaded file metadata objects
 */
export async function uploadMultiple(files, onFileProgress, onFileComplete) {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const meta = await uploadFile(
      files[i],
      (pct) => onFileProgress && onFileProgress(i, pct),
    );
    results.push(meta);
    if (onFileComplete) onFileComplete(i, meta);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────

/**
 * Fetch the list of files visible to the current user.
 * Admins see all files; regular users see only their own.
 *
 * @returns {object[]} array of file metadata objects
 */
export async function listFiles() {
  const response = await api.get('/files');
  return response.data.files || [];
}

// ─────────────────────────────────────────────────────────────
// PREVIEW & DOWNLOAD
// ─────────────────────────────────────────────────────────────

/**
 * Obtain preview information and pre-signed inline URL for a file.
 *
 * @param {string} key — S3 object key
 * @returns {Promise<{ url, name, mimeType, size }>}
 */
export async function getFilePreview(key) {
  const response = await api.get(`/files/preview/${encodeURIComponent(key)}`);
  return response.data;
}

/**
 * Fetch raw text/code content directly for text preview.
 *
 * @param {string} key — S3 object key
 * @returns {Promise<string>}
 */
export async function getFileContent(key) {
  const response = await api.get(`/files/content/${encodeURIComponent(key)}`, {
    responseType: 'text',
  });
  return response.data;
}

/**
 * Obtain a short-lived pre-signed S3 download URL for a file.
 *
 * @param {string} key — S3 object key
 * @returns {string} signed URL (valid for ~15 minutes)
 */
export async function getDownloadUrl(key) {
  const response = await api.get(`/files/download/${encodeURIComponent(key)}`);
  return response.data.url;
}

/**
 * Trigger a browser download for the given S3 key.
 * Fetches the signed URL then programmatically clicks a link.
 *
 * @param {string} key      — S3 object key
 * @param {string} fileName — suggested download filename
 */
export async function downloadFile(key, fileName) {
  const url = await getDownloadUrl(key);
  const a   = document.createElement('a');
  a.href        = url;
  a.download    = fileName || key.split('/').pop();
  a.target      = '_blank';
  a.rel         = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

/**
 * Permanently delete a file from S3 and remove its Firestore metadata.
 *
 * @param {string} key — S3 object key
 * @returns {string} success message
 */
export async function deleteFile(key) {
  const response = await api.delete(`/files/${encodeURIComponent(key)}`);
  return response.data.message;
}

// ─────────────────────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Format a byte count into a human-readable string.
 * @param {number} bytes
 * @returns {string} e.g. "1.4 MB"
 */
export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes === 0)           return '0 B';
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1_048_576)     return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

/**
 * Return a CSS colour string that represents a MIME type category.
 * Used to colour file-type badges in the UI.
 *
 * @param {string} mimeType
 * @returns {string} hex colour
 */
export function mimeTypeColor(mimeType) {
  if (!mimeType) return '#64748b';
  if (mimeType.startsWith('image/'))       return '#22c55e';
  if (mimeType.startsWith('video/'))       return '#a855f7';
  if (mimeType.startsWith('text/'))        return '#38bdf8';
  if (mimeType.includes('pdf'))            return '#ef4444';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '#84cc16';
  if (mimeType.includes('zip') || mimeType.includes('tar'))           return '#f59e0b';
  if (mimeType.includes('json') || mimeType.includes('xml'))          return '#06b6d4';
  return '#64748b';
}

export default {
  uploadFile,
  uploadMultiple,
  listFiles,
  getFilePreview,
  getFileContent,
  getDownloadUrl,
  downloadFile,
  deleteFile,
  formatFileSize,
  mimeTypeColor,
};
