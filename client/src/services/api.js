/**
 * services/api.js
 * ----------------
 * Centralised Axios client for all API calls to the Node.js backend.
 *
 * CRITICAL FIX: Per-session token management
 * - Each browser tab uses its own session-specific token
 * - No cross-tab authentication contamination
 * - Admin sessions remain admin, user sessions remain user
 *
 * - Automatically attaches the JWT token from localStorage to every request.
 * - Handles 401 responses globally by clearing auth state and redirecting.
 * - Provides named functions for every backend endpoint so pages never
 *   construct URLs manually.
 */

import axios from 'axios';

// Base URL — falls back to localhost:5000 in development.
// Set REACT_APP_API_URL in client/.env for other environments.
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * CRITICAL FIX: Get current session ID from DOM
 * Each tab has a unique session ID stored in the React component tree.
 * We retrieve it from the window object where App.js will attach it.
 */
function getSessionId() {
  // The session ID is set by App.js via a custom event
  return window.__KIRO_SESSION_ID__ || null;
}

/**
 * CRITICAL FIX: Get session-specific token key
 */
function getTokenKey() {
  const sessionId = getSessionId();
  return sessionId ? `token_${sessionId}` : 'token';
}

/**
 * CRITICAL FIX: Get session-specific user key
 */
function getUserKey() {
  const sessionId = getSessionId();
  return sessionId ? `user_${sessionId}` : 'user';
}

// ── Request interceptor ─────────────────────────────────────
// CRITICAL FIX: Attach session-specific Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(getTokenKey());
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ────────────────────────────────────
// Handles both 401 (expired/invalid token) and 403 (account restricted).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data   = error.response?.data;

    // ── 401: token invalid or expired ───────────────────────
    if (status === 401) {
      // Clear THIS session's auth data only
      localStorage.removeItem(getTokenKey());
      localStorage.removeItem(getUserKey());

      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // ── 403 ACCOUNT_RESTRICTED: account temporarily blocked ─
    // Redirect to the /restricted page so the user sees a clear
    // explanation instead of a silent API failure.
    // We do NOT clear the token — the user's identity is still
    // valid; only their access is suspended.
    if (status === 403 && data?.code === 'ACCOUNT_RESTRICTED') {
      // Store the restriction details so the RestrictedPage can display them
      try {
        sessionStorage.setItem(
          'restriction_info',
          JSON.stringify({
            message:           data.message           || 'Your account is temporarily restricted.',
            restrictionReason: data.restrictionReason || null,
            restrictionExpiry: data.restrictionExpiry || null,
            restrictionSource: data.restrictionSource || 'manual',
          })
        );
      } catch { /* sessionStorage unavailable — proceed anyway */ }

      if (!window.location.pathname.includes('/restricted')) {
        window.location.href = '/restricted';
      }
    }

    return Promise.reject(error);
  }
);

// ════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════

/** POST /auth/register — create a new account */
export const registerUser = (data) =>
  api.post('/auth/register', data);

/** POST /auth/login — returns { user, token } */
export const loginUser = (data) =>
  api.post('/auth/login', data);

/** POST /auth/logout — records logout event in Firestore; client must clear token */
export const logoutUser = () =>
  api.post('/auth/logout');

/** GET /auth/me — returns the currently authenticated user */
export const getMe = () =>
  api.get('/auth/me');

/** POST /auth/forgot-password — request a password-reset email (public, no token needed) */
export const forgotPassword = (data) =>
  api.post('/auth/forgot-password', data);

/** POST /auth/reset-password — submit new password with reset token (public) */
export const resetPassword = (data) =>
  api.post('/auth/reset-password', data);

// ════════════════════════════════════════════════════════════
// FILES  (AWS S3)
// ════════════════════════════════════════════════════════════

/** GET /files — list files for the current user */
export const getFiles = () =>
  api.get('/files');

/**
 * POST /files/upload — upload a file to S3.
 * @param {FormData} formData — must contain a 'file' field.
 */
export const uploadFile = (formData) =>
  api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** GET /files/download/:key — get a pre-signed S3 download URL */
export const getFileUrl = (key) =>
  api.get(`/files/download/${encodeURIComponent(key)}`);

/** GET /files/preview/:key — get an inline pre-signed preview URL */
export const getFilePreview = (key) =>
  api.get(`/files/preview/${encodeURIComponent(key)}`);

/** GET /files/content/:key — stream text/code file content directly */
export const getFileContent = (key) =>
  api.get(`/files/content/${encodeURIComponent(key)}`, { responseType: 'text' });

/** DELETE /files/:key — delete a file from S3 */
export const deleteFile = (key) =>
  api.delete(`/files/${encodeURIComponent(key)}`);

// ════════════════════════════════════════════════════════════
// USERS  (Admin only)
// ════════════════════════════════════════════════════════════

/** GET /users — list all users (admin only) */
export const getAllUsers = () =>
  api.get('/users');

/** GET /users/activity-summary — user metadata and file counts (admin only) */
export const getUserActivity = () =>
  api.get('/users/activity-summary');

/** DELETE /users/:id — remove a user (admin only) */
export const deleteUser = (id) =>
  api.delete(`/users/${id}`);

/** PATCH /users/:id/role — update user role (admin only) */
export const updateUserRole = (id, role) =>
  api.patch(`/users/${id}/role`, { role });

/** MODULE 1: PATCH /users/:id/restrict — temporarily restrict user account (admin only) */
export const restrictUser = (id, reason, expiryMinutes) =>
  api.patch(`/users/${id}/restrict`, { reason, expiryMinutes, source: 'manual' });

/** MODULE 1: PATCH /users/:id/release — release account restriction (admin only) */
export const releaseRestriction = (id) =>
  api.patch(`/users/${id}/release`);

/** GET /users/stats — stats for the current user's own activity */
export const getUserStats = () =>
  api.get('/users/stats');


// ════════════════════════════════════════════════════════════
// THREATS  (ML Service results)
// ════════════════════════════════════════════════════════════

/** GET /threats — list threat detection records */
export const getThreats = (params) =>
  api.get('/threats', { params });

/** GET /threats/stats — aggregated threat statistics */
export const getThreatStats = () =>
  api.get('/threats/stats');

/** GET /threats/recent — most recent N threat records */
export const getRecentThreats = (limit = 20) =>
  api.get('/threats/recent', { params: { limit } });

/** GET /threats/:id — full threat detail + correlated activity (admin only) */
export const getThreatDetail = (id) =>
  api.get(`/threats/${encodeURIComponent(id)}`);

/**
 * POST /threats/analyze — send raw network data to the ML service
 * via the backend proxy and receive a threat prediction.
 * @param {object} data — network activity features
 */
export const analyzeActivity = (data) =>
  api.post('/threats/analyze', data);

// ════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════

/** GET /users/admin/stats — platform-wide statistics (admin only) */
export const getAdminStats = () =>
  api.get('/users/admin/stats');

/** GET /users/admin/security-summary — restriction counts + recent security events (admin only) */
export const getAdminSecuritySummary = () =>
  api.get('/users/admin/security-summary');

// ════════════════════════════════════════════════════════════
// ACTIVITY LOGS  (Firebase)
// ════════════════════════════════════════════════════════════

/** GET /logs — fetch activity logs from Firebase (admin only) */
export const getActivityLogs = (params) =>
  api.get('/logs', { params });

export default api;
