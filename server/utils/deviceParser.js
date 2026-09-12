/**
 * utils/deviceParser.js
 * ----------------------
 * Parse User-Agent strings to extract device, OS, and browser information.
 * 
 * Supports:
 * - Windows (all versions)
 * - Linux (Ubuntu, Debian, Fedora, etc.)
 * - macOS
 * - iOS (iPhone, iPad)
 * - Android
 * - Chrome, Firefox, Safari, Edge, Opera, and other browsers
 * 
 * Works for desktop and mobile devices without hardcoding or manual configuration.
 */

/**
 * Parse User-Agent string and extract device information.
 * 
 * @param {string} userAgent - User-Agent header from request
 * @returns {object} - { device, os, browser, raw }
 */
function parseUserAgent(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') {
    return {
      device: 'Unknown',
      os: 'Unknown',
      browser: 'Unknown',
      raw: '',
    };
  }

  const ua = userAgent.toLowerCase();
  
  return {
    device: detectDevice(ua, userAgent),
    os: detectOS(ua, userAgent),
    browser: detectBrowser(ua, userAgent),
    raw: userAgent,
  };
}

/**
 * Detect device type (Desktop, Mobile, Tablet).
 * 
 * @param {string} ua - Lowercase User-Agent
 * @param {string} original - Original User-Agent
 * @returns {string}
 */
function detectDevice(ua, original) {
  // Mobile indicators
  if (ua.includes('mobile') || ua.includes('android')) {
    // Check if it's a tablet
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'Tablet';
    }
    
    // Specific phone models
    if (ua.includes('iphone')) return 'iPhone';
    if (ua.includes('android')) return 'Android Phone';
    
    return 'Mobile';
  }
  
  // Tablet indicators
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return ua.includes('ipad') ? 'iPad' : 'Tablet';
  }
  
  // Desktop
  return 'Desktop';
}

/**
 * Detect operating system and version.
 * 
 * @param {string} ua - Lowercase User-Agent
 * @param {string} original - Original User-Agent
 * @returns {string}
 */
function detectOS(ua, original) {
  // Windows detection with version
  if (ua.includes('windows nt 10.0')) return 'Windows 10/11';
  if (ua.includes('windows nt 6.3'))  return 'Windows 8.1';
  if (ua.includes('windows nt 6.2'))  return 'Windows 8';
  if (ua.includes('windows nt 6.1'))  return 'Windows 7';
  if (ua.includes('windows nt 6.0'))  return 'Windows Vista';
  if (ua.includes('windows nt 5.1'))  return 'Windows XP';
  if (ua.includes('windows'))         return 'Windows';
  
  // macOS/iOS detection
  if (ua.includes('iphone os')) {
    const match = original.match(/iPhone OS (\d+)[_.](\d+)/i);
    if (match) return `iOS ${match[1]}.${match[2]}`;
    return 'iOS';
  }
  if (ua.includes('ipad')) {
    const match = original.match(/CPU OS (\d+)[_.](\d+)/i);
    if (match) return `iPadOS ${match[1]}.${match[2]}`;
    return 'iPadOS';
  }
  if (ua.includes('mac os x')) {
    const match = original.match(/Mac OS X (\d+)[_.](\d+)/i);
    if (match) return `macOS ${match[1]}.${match[2]}`;
    return 'macOS';
  }
  if (ua.includes('macintosh')) return 'macOS';
  
  // Android detection with version
  if (ua.includes('android')) {
    const match = original.match(/Android (\d+(?:\.\d+)?)/i);
    if (match) return `Android ${match[1]}`;
    return 'Android';
  }
  
  // Linux distributions
  if (ua.includes('ubuntu'))     return 'Ubuntu';
  if (ua.includes('debian'))     return 'Debian';
  if (ua.includes('fedora'))     return 'Fedora';
  if (ua.includes('red hat'))    return 'Red Hat';
  if (ua.includes('centos'))     return 'CentOS';
  if (ua.includes('arch linux')) return 'Arch Linux';
  if (ua.includes('linux'))      return 'Linux';
  
  // Other Unix-like
  if (ua.includes('freebsd'))    return 'FreeBSD';
  if (ua.includes('openbsd'))    return 'OpenBSD';
  if (ua.includes('sunos'))      return 'Solaris';
  
  // ChromeOS
  if (ua.includes('cros'))       return 'Chrome OS';
  
  return 'Unknown OS';
}

/**
 * Detect browser and version.
 * 
 * @param {string} ua - Lowercase User-Agent
 * @param {string} original - Original User-Agent
 * @returns {string}
 */
function detectBrowser(ua, original) {
  // Order matters: check more specific browsers first
  
  // Edge (Chromium-based)
  if (ua.includes('edg/') || ua.includes('edge/')) {
    const match = original.match(/Edg[e]?\/(\d+(?:\.\d+)?)/i);
    if (match) return `Edge ${match[1]}`;
    return 'Edge';
  }
  
  // Opera
  if (ua.includes('opr/') || ua.includes('opera/')) {
    const match = original.match(/(?:OPR|Opera)\/(\d+(?:\.\d+)?)/i);
    if (match) return `Opera ${match[1]}`;
    return 'Opera';
  }
  
  // Chrome (must be after Edge and Opera, as they include "chrome")
  if (ua.includes('chrome/') && !ua.includes('edg') && !ua.includes('opr')) {
    const match = original.match(/Chrome\/(\d+(?:\.\d+)?)/i);
    if (match) return `Chrome ${match[1]}`;
    return 'Chrome';
  }
  
  // Safari (must be after Chrome, as Chrome includes "safari")
  if (ua.includes('safari/') && !ua.includes('chrome') && !ua.includes('chromium')) {
    const match = original.match(/Version\/(\d+(?:\.\d+)?)/i);
    if (match) return `Safari ${match[1]}`;
    return 'Safari';
  }
  
  // Firefox
  if (ua.includes('firefox/')) {
    const match = original.match(/Firefox\/(\d+(?:\.\d+)?)/i);
    if (match) return `Firefox ${match[1]}`;
    return 'Firefox';
  }
  
  // Internet Explorer (legacy)
  if (ua.includes('msie') || ua.includes('trident/')) {
    const match = original.match(/(?:MSIE |rv:)(\d+(?:\.\d+)?)/i);
    if (match) return `IE ${match[1]}`;
    return 'Internet Explorer';
  }
  
  // Samsung Internet
  if (ua.includes('samsungbrowser/')) {
    const match = original.match(/SamsungBrowser\/(\d+(?:\.\d+)?)/i);
    if (match) return `Samsung Internet ${match[1]}`;
    return 'Samsung Internet';
  }
  
  // UC Browser
  if (ua.includes('ucbrowser/')) {
    const match = original.match(/UCBrowser\/(\d+(?:\.\d+)?)/i);
    if (match) return `UC Browser ${match[1]}`;
    return 'UC Browser';
  }
  
  // Brave (hard to detect, often reports as Chrome)
  if (ua.includes('brave')) {
    return 'Brave';
  }
  
  // Generic mobile browsers
  if (ua.includes('mobile')) return 'Mobile Browser';
  
  return 'Unknown Browser';
}

/**
 * Get comprehensive client information from an Express request.
 * Combines IP extraction with device parsing.
 * 
 * @param {object} req - Express request object
 * @returns {object} - { ip, device, os, browser, userAgent }
 */
function getClientInfo(req) {
  const { getClientIp } = require('./ipExtractor');
  const userAgent = req.get('User-Agent') || '';
  const deviceInfo = parseUserAgent(userAgent);
  
  return {
    ip: getClientIp(req),
    device: deviceInfo.device,
    os: deviceInfo.os,
    browser: deviceInfo.browser,
    userAgent: deviceInfo.raw,
  };
}

/**
 * Format client info as a human-readable string.
 * 
 * @param {object} clientInfo - Object from getClientInfo()
 * @returns {string}
 */
function formatClientInfo(clientInfo) {
  const { ip, device, os, browser } = clientInfo;
  return `${device} • ${os} • ${browser} • ${ip}`;
}

module.exports = {
  parseUserAgent,
  detectDevice,
  detectOS,
  detectBrowser,
  getClientInfo,
  formatClientInfo,
};
