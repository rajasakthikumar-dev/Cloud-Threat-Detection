/**
 * Device Parser Test Script
 * --------------------------
 * Demonstrates device detection for various User-Agent strings.
 * Run: node test_device_parser.js
 */

const { parseUserAgent, formatClientInfo } = require('./utils/deviceParser');

// Test User-Agent strings representing different platforms
const testCases = [
  {
    name: 'Windows 11 + Chrome',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'
  },
  {
    name: 'Ubuntu 22.04 + Firefox',
    ua: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
  },
  {
    name: 'iPhone 14 (iOS 16.5) + Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  {
    name: 'Samsung Galaxy S23 (Android 13) + Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36'
  },
  {
    name: 'iPad Pro (iPadOS 16) + Safari',
    ua: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  {
    name: 'macOS Sonoma + Safari',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  },
  {
    name: 'Edge on Windows 11',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91'
  },
  {
    name: 'Opera on Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/105.0.0.0'
  },
  {
    name: 'Debian Linux + Firefox',
    ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
  },
];

console.log('\n' + '='.repeat(80));
console.log('DEVICE PARSER TEST - User-Agent Detection');
console.log('='.repeat(80) + '\n');

testCases.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`);
  console.log('-'.repeat(80));
  
  const result = parseUserAgent(test.ua);
  
  console.log(`  Device:       ${result.device}`);
  console.log(`  OS:           ${result.os}`);
  console.log(`  Browser:      ${result.browser}`);
  console.log(`  User-Agent:   ${test.ua.substring(0, 60)}...`);
  console.log('');
  
  // Show formatted output (what appears in activity logs)
  const formatted = formatClientInfo({
    ip: '203.0.113.45',
    device: result.device,
    os: result.os,
    browser: result.browser,
    userAgent: result.raw
  });
  console.log(`  Formatted:    ${formatted}`);
  console.log('');
});

console.log('='.repeat(80));
console.log('✅ All tests complete!');
console.log('='.repeat(80) + '\n');

// Test with mock Express request object
console.log('Testing with mock Express request object:');
console.log('-'.repeat(80));

const { getClientInfo } = require('./utils/deviceParser');

const mockReq = {
  ip: '198.51.100.42',
  get: (header) => {
    if (header === 'User-Agent') {
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15';
    }
    return undefined;
  }
};

const clientInfo = getClientInfo(mockReq);
console.log('Mock Request Results:');
console.log(`  IP:           ${clientInfo.ip}`);
console.log(`  Device:       ${clientInfo.device}`);
console.log(`  OS:           ${clientInfo.os}`);
console.log(`  Browser:      ${clientInfo.browser}`);
console.log(`  Formatted:    ${formatClientInfo(clientInfo)}`);
console.log('\n' + '='.repeat(80) + '\n');
