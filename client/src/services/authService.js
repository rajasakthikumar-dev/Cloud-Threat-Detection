/**
 * client/src/services/authService.js
 * ------------------------------------
 * Authentication service layer.
 *
 * Wraps the raw api.js axios calls with business logic:
 *   - Persists user + token to localStorage
 *   - Decodes JWT for expiry checking
 *   - Provides helpers used by pages and AuthContext
 *
 * Pages should import from here rather than calling api.js directly
 * so that token management stays in one place.
 */

import api from './api';
import { jwtDecode } from 'jwt-decode';

// ─────────────────────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────────────────────
const TOKEN_KEY = 'token';
const USER_KEY  = 'user';

// ─────────────────────────────────────────────────────────────
// TOKEN HELPERS
// ─────────────────────────────────────────────────────────────

/** Store JWT token in localStorage */
export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Retrieve JWT token from localStorage */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** Remove token and user from localStorage */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Check whether the stored JWT is still valid (not expired).
 * Returns true if valid, false if expired or missing.
 */
export function isTokenValid() {
  const token = getToken();
  if (!token) return false;
  try {
    const { exp } = jwtDecode(token);
    // exp is in seconds; Date.now() is in milliseconds
    return exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/**
 * Decode and return the JWT payload without verifying signature.
 * Used to read user id / role from the stored token.
 */
export function getTokenPayload() {
  const token = getToken();
  if (!token) return null;
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// USER STORAGE HELPERS
// ─────────────────────────────────────────────────────────────

/** Persist user object (without password) to localStorage */
export function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Read user object from localStorage */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// AUTH API CALLS
// ─────────────────────────────────────────────────────────────

/**
 * Register a new user account.
 *
 * @param {{ name, email, password, role }} data
 * @returns {{ user, token }}
 */
export async function register({ name, email, password, role = 'user' }) {
  const response = await api.post('/auth/register', { name, email, password, role });
  const { user, token } = response.data;

  // Persist immediately so the user is auto-logged-in after registration
  saveToken(token);
  saveUser(user);

  return { user, token };
}

/**
 * Log in with email + password.
 *
 * @param {{ email, password }} credentials
 * @returns {{ user, token }}
 */
export async function login({ email, password }) {
  const response = await api.post('/auth/login', { email, password });
  const { user, token } = response.data;

  saveToken(token);
  saveUser(user);

  return { user, token };
}

/**
 * Log out the current user.
 * Clears localStorage; caller is responsible for updating React state.
 */
export function logout() {
  clearAuth();
}

/**
 * Fetch the currently authenticated user from the server.
 * Useful for rehydrating auth state after a page reload.
 *
 * @returns {object} user profile
 */
export async function fetchCurrentUser() {
  const response = await api.get('/auth/me');
  const { user } = response.data;
  // Refresh stored user with latest data from server
  saveUser(user);
  return user;
}

/**
 * Check auth state on app load:
 *   1. If no token → not authenticated
 *   2. If token expired → clear and return null
 *   3. If token valid → return stored user (optionally refresh from server)
 *
 * @param {boolean} refreshFromServer — call /auth/me to get fresh data
 * @returns {object|null} user or null
 */
export async function checkAuth(refreshFromServer = false) {
  if (!isTokenValid()) {
    clearAuth();
    return null;
  }

  if (refreshFromServer) {
    try {
      return await fetchCurrentUser();
    } catch {
      clearAuth();
      return null;
    }
  }

  return getStoredUser();
}

// ─────────────────────────────────────────────────────────────
// ROLE HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Returns true if the currently stored user has the given role.
 * @param {string} role — 'admin' | 'user'
 */
export function hasRole(role) {
  const user = getStoredUser();
  return user?.role === role;
}

/** Returns true if the current user is an admin */
export function isAdmin() {
  return hasRole('admin');
}

export default {
  register,
  login,
  logout,
  fetchCurrentUser,
  checkAuth,
  isTokenValid,
  isAdmin,
  hasRole,
  getToken,
  getStoredUser,
  getTokenPayload,
};
