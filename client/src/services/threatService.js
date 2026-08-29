/**
 * client/src/services/threatService.js
 * ---------------------------------------
 * Threat intelligence service layer.
 *
 * Wraps all threat-related API calls with typed helpers and
 * data-transformation utilities used across dashboard pages.
 *
 * Flow:
 *   Page → threatService → api.js → Node.js backend → FastAPI ML service
 *                                         │
 *                                    Firebase (logs)
 *                                    Socket.io (real-time alert)
 */

import api from './api';

// ─────────────────────────────────────────────────────────────
// RISK LEVEL CONSTANTS
// ─────────────────────────────────────────────────────────────
export const RISK_LEVELS = {
  LOW:    'Low',
  MEDIUM: 'Medium',
  HIGH:   'High',
};

export const RISK_COLORS = {
  Low:    '#22c55e',
  Medium: '#f59e0b',
  High:   '#ef4444',
};

export const ATTACK_CATEGORIES = [
  'Normal', 'Analysis', 'Backdoor', 'DoS', 'Exploits',
  'Fuzzers', 'Generic', 'Reconnaissance', 'Shellcode', 'Worms',
];

// ─────────────────────────────────────────────────────────────
// ANALYZE — send features to ML service via backend
// ─────────────────────────────────────────────────────────────

/**
 * Submit a network activity feature set for threat analysis.
 * The backend proxies this to the FastAPI ML service, then logs
 * the result to Firebase and emits a Socket.io alert if needed.
 *
 * @param {object} features   — key/value map of UNSW-NB15 feature names
 * @param {string} [sourceIp] — optional source IP for logging
 * @returns {{ attack_type, risk_level, confidence_score, binary_prediction }}
 */
export async function analyzeActivity(features, sourceIp) {
  const response = await api.post('/threats/analyze', {
    features,
    source_ip: sourceIp || null,
  });
  return response.data;
}

// ─────────────────────────────────────────────────────────────
// FETCH THREATS
// ─────────────────────────────────────────────────────────────

/**
 * Fetch paginated threat detection records.
 *
 * @param {{ limit?, risk_level? }} params
 * @returns {object[]} array of threat records
 */
export async function getThreats(params = {}) {
  const response = await api.get('/threats', { params });
  return response.data.threats || [];
}

/**
 * Fetch the most recent N threat records.
 *
 * @param {number} limit — max records to return (default 20)
 * @returns {object[]}
 */
export async function getRecentThreats(limit = 20) {
  const response = await api.get('/threats/recent', { params: { limit } });
  return response.data.threats || [];
}

/**
 * Fetch aggregated threat statistics for charts.
 *
 * @returns {{
 *   total, high, medium, low,
 *   categories: [{category, count}],
 *   timeline:   [{time, normal, attack}]
 * }}
 */
export async function getThreatStats() {
  const response = await api.get('/threats/stats');
  return response.data;
}

// ─────────────────────────────────────────────────────────────
// ADMIN STATS
// ─────────────────────────────────────────────────────────────

/**
 * Fetch platform-wide statistics (admin only).
 *
 * @returns {{
 *   totalUsers, totalFiles, totalThreats, activeAlerts,
 *   riskDistribution, categoryBreakdown, trafficTimeline
 * }}
 */
export async function getAdminStats() {
  const response = await api.get('/users/admin/stats');
  return response.data;
}

/**
 * Fetch stats scoped to the current user (own files, own threats).
 *
 * @returns {{ myFiles, myThreats, lastScan, status }}
 */
export async function getUserStats() {
  const response = await api.get('/users/stats');
  return response.data;
}

// ─────────────────────────────────────────────────────────────
// ACTIVITY LOGS (Firebase — admin only)
// ─────────────────────────────────────────────────────────────

/**
 * Fetch activity logs from Firebase (admin only).
 *
 * @param {{ limit?, event_type? }} params
 * @returns {object[]} array of log records
 */
export async function getActivityLogs(params = {}) {
  const response = await api.get('/logs', { params });
  return response.data.logs || [];
}

// ─────────────────────────────────────────────────────────────
// UI HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Return the CSS colour for a given risk level string.
 * @param {string} riskLevel — 'Low' | 'Medium' | 'High'
 * @returns {string} hex colour
 */
export function getRiskColor(riskLevel) {
  return RISK_COLORS[riskLevel] || '#64748b';
}

/**
 * Return a human-readable label and colour config for a risk level badge.
 * @param {string} riskLevel
 * @returns {{ label, color, background }}
 */
export function getRiskBadgeProps(riskLevel) {
  const configs = {
    High:   { label: '🔴 HIGH',   color: '#fca5a5', background: '#450a0a' },
    Medium: { label: '🟡 MEDIUM', color: '#fcd34d', background: '#1c1208' },
    Low:    { label: '🟢 LOW',    color: '#86efac', background: '#071a0e' },
  };
  return configs[riskLevel] || { label: riskLevel, color: '#94a3b8', background: '#1e293b' };
}

/**
 * Build a chart-ready array of risk distribution data.
 * @param {{ high, medium, low }} stats
 * @returns {[{ name, value }]}
 */
export function buildRiskDistribution(stats) {
  return [
    { name: 'Low',    value: stats?.low    || 0 },
    { name: 'Medium', value: stats?.medium || 0 },
    { name: 'High',   value: stats?.high   || 0 },
  ];
}

/**
 * Filter a threats array by risk level.
 * @param {object[]} threats
 * @param {string}   riskLevel — 'All' | 'Low' | 'Medium' | 'High'
 * @returns {object[]}
 */
export function filterByRisk(threats, riskLevel) {
  if (!riskLevel || riskLevel === 'All') return threats;
  return threats.filter(t => t.risk_level === riskLevel);
}

/**
 * Sort threats by timestamp (newest first).
 * @param {object[]} threats
 * @returns {object[]}
 */
export function sortByNewest(threats) {
  return [...threats].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
}

/**
 * Export threat records as a JSON file download.
 * @param {object[]} threats
 * @param {string}   filename
 */
export function exportThreatsAsJson(threats, filename = 'threat-report.json') {
  const blob = new Blob([JSON.stringify(threats, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export threat records as a CSV file download.
 * @param {object[]} threats
 * @param {string}   filename
 */
export function exportThreatsAsCsv(threats, filename = 'threat-report.csv') {
  if (!threats.length) return;
  const headers = Object.keys(threats[0]).join(',');
  const rows    = threats.map(t =>
    Object.values(t).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  );
  const csv  = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default {
  analyzeActivity,
  getThreats,
  getRecentThreats,
  getThreatStats,
  getAdminStats,
  getUserStats,
  getActivityLogs,
  getRiskColor,
  getRiskBadgeProps,
  buildRiskDistribution,
  filterByRisk,
  sortByNewest,
  exportThreatsAsJson,
  exportThreatsAsCsv,
};
