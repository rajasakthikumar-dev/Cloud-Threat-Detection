/**
 * Test Admin Dashboard APIs
 * Verifies that backend endpoints return real Firestore data
 */

require('dotenv').config();
const axios = require('axios');

const NODE_URL = 'http://localhost:5000';

async function test() {
  console.log('\n' + '='.repeat(70));
  console.log('  ADMIN API TEST');
  console.log('='.repeat(70) + '\n');

  // Login as admin
  let token;
  try {
    const loginRes = await axios.post(`${NODE_URL}/api/auth/login`, {
      email: 'r@gmail.com',
      password: '123'
    });
    token = loginRes.data.token;
    const user = loginRes.data.user;
    console.log(`✓ Logged in as: ${user.email} (${user.role})\n`);
  } catch (err) {
    console.error('✗ Login failed:', err.response?.data?.message || err.message);
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${token}` };

  // Test admin stats
  console.log('[GET /api/users/admin/stats]');
  try {
    const res = await axios.get(`${NODE_URL}/api/users/admin/stats`, { headers });
    const d = res.data;
    console.log(`  totalUsers: ${d.totalUsers}`);
    console.log(`  totalFiles: ${d.totalFiles}`);
    console.log(`  totalThreats: ${d.totalThreats}`);
    console.log(`  activeAlerts: ${d.activeAlerts}`);
    console.log(`  riskDistribution: Low=${d.riskDistribution.find(r=>r.name==='Low')?.value || 0}, Medium=${d.riskDistribution.find(r=>r.name==='Medium')?.value || 0}, High=${d.riskDistribution.find(r=>r.name==='High')?.value || 0}`);
    console.log(`  categoryBreakdown: ${JSON.stringify(d.categoryBreakdown)}`);
  } catch (err) {
    console.error('  ✗ Failed:', err.response?.data?.message || err.message);
  }

  // Test users list
  console.log('\n[GET /api/users]');
  try {
    const res = await axios.get(`${NODE_URL}/api/users`, { headers });
    const users = res.data.users;
    console.log(`  Returned ${users.length} users:`);
    users.slice(0, 5).forEach(u => {
      console.log(`    - ${u.email} / ${u.role} / ${u.name}`);
    });
  } catch (err) {
    console.error('  ✗ Failed:', err.response?.data?.message || err.message);
  }

  // Test activity logs
  console.log('\n[GET /api/logs]');
  try {
    const res = await axios.get(`${NODE_URL}/api/logs?limit=10`, { headers });
    const logs = res.data.logs;
    console.log(`  Returned ${logs.length} logs:`);
    logs.slice(0, 5).forEach(l => {
      console.log(`    - ${l.event_type} / ${l.user_email}`);
    });
  } catch (err) {
    console.error('  ✗ Failed:', err.response?.data?.message || err.message);
  }

  // Test recent threats
  console.log('\n[GET /api/threats/recent]');
  try {
    const res = await axios.get(`${NODE_URL}/api/threats/recent?limit=10`, { headers });
    const threats = res.data.threats;
    console.log(`  Returned ${threats.length} threats:`);
    threats.forEach(t => {
      console.log(`    - ${t.attack_type} / ${t.risk_level} / ${t.confidence_score}%`);
    });
  } catch (err) {
    console.error('  ✗ Failed:', err.response?.data?.message || err.message);
  }

  console.log('\n' + '='.repeat(70) + '\n');
  process.exit(0);
}

test();
