/**
 * utils/ipExtractor.js
 * ---------------------
 * Centralized utility for extracting the real client IP address from requests.
 * 
 * SECURITY-FIRST IMPLEMENTATION:
 * This utility DOES NOT manually read X-Forwarded-For or X-Real-IP headers.
 * Instead, it relies on Express's built-in trust proxy mechanism, which is
 * the ONLY safe way to handle proxy-forwarded IP addresses.
 * 
 * WHY MANUAL HEADER READING IS DANGEROUS:
 * - Malicious clients can forge X-Forwarded-For headers
 * - Without trust proxy, Express ignores these headers (correct behavior)
 * - Manually reading req.headers['x-forwarded-for'] bypasses Express's validation
 * - This allows IP spoofing attacks
 * 
 * CORRECT ARCHITECTURE:
 * 
 *   Client (Real IP: 203.0.113.45)
 *        ↓
 *   Internet
 *        ↓
 *   Trusted Reverse Proxy (Render/AWS/Nginx)
 *        ↓ Adds X-Forwarded-For: 203.0.113.45
 *   Express (trust proxy = 1)
 *        ↓ Validates and parses headers
 *   req.ip = "203.0.113.45" ✅
 *        ↓
 *   getClientIp(req) returns req.ip
 *        ↓
 *   Stored in Firestore
 * 
 * Express's trust proxy setting determines which proxies to trust.
 * When trust proxy = 1, Express:
 * - Trusts X-Forwarded-For from the FIRST proxy hop
 * - Populates req.ip with the leftmost (original client) IP
 * - Ignores client-spoofed headers (security)
 * 
 * When trust proxy = false (default):
 * - Express ignores ALL X-Forwarded-For headers
 * - req.ip returns the direct socket connection IP (proxy's IP)
 * - This is correct for security but wrong for production deployment
 * 
 * USAGE:
 * const clientIp = getClientIp(req);
 */

/**
 * Extract the real client IP address from an Express request.
 * 
 * SECURITY: Uses Express's trusted req.ip, NOT raw headers.
 * 
 * @param {object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIp(req) {
  // Use Express's trusted req.ip
  // This respects the trust proxy setting and is SAFE
  if (req.ip) {
    return normalizeIp(req.ip);
  }

  // Fallback to socket remote address (direct connection, no proxy)
  // Only used if req.ip is somehow unavailable
  if (req.socket?.remoteAddress) {
    return normalizeIp(req.socket.remoteAddress);
  }

  // Final fallback
  return 'unknown';
}

/**
 * Normalize IP address format.
 * Converts IPv6-mapped IPv4 addresses to standard IPv4.
 * 
 * Examples:
 * - "::ffff:192.168.1.1" → "192.168.1.1"
 * - "::ffff:127.0.0.1" → "127.0.0.1"
 * - "::1" → "::1" (localhost IPv6, preserved)
 * - "127.0.0.1" → "127.0.0.1" (localhost IPv4, preserved)
 * 
 * IMPORTANT: Does NOT replace localhost IPs with fake public IPs.
 * Localhost during development is EXPECTED and CORRECT.
 * 
 * @param {string} ip - Raw IP address
 * @returns {string} - Normalized IP address
 */
function normalizeIp(ip) {
  if (!ip) return 'unknown';
  
  // Remove IPv6 prefix for IPv4-mapped addresses
  // Example: ::ffff:203.0.113.45 → 203.0.113.45
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  return ip.trim();
}

/**
 * Check if an IP address is localhost/loopback.
 * Useful for distinguishing local development from production.
 * 
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if localhost
 */
function isLocalhost(ip) {
  const normalized = normalizeIp(ip);
  return normalized === '127.0.0.1' || 
         normalized === '::1' || 
         normalized === 'localhost' ||
         normalized === '0.0.0.0' ||
         normalized === '::';
}

module.exports = {
  getClientIp,
  normalizeIp,
  isLocalhost,
};
