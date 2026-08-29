/**
 * services/api.js
 * ----------------
 * Centralised Axios client for all API calls to the Node.js backend.
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

// ── Request interceptor ─────────────────────────────────────
// Attach Bearer token to every outgoing request if one exists.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ────────────────────────────────────
// On 401 Unauthorized, clear local auth state and redirect to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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

// ════════════════════════════════════════════════════════════
// ACTIVITY LOGS  (Firebase)
// ════════════════════════════════════════════════════════════

/** GET /logs — fetch activity logs from Firebase (admin only) */
export const getActivityLogs = (params) =>
  api.get('/logs', { params });

export default api;
