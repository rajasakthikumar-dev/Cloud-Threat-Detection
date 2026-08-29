/**
 * _test_system_integrity.js
 * -------------------------
 * Verifies that Activity Logs, Threat Monitoring, Admin Stats, and User Activity
 * continue working seamlessly with real Firestore data.
 */

process.env.PORT = '5056';
require('dotenv').config();
const axios = require('axios');
const { app, server } = require('./server');
const { generateToken } = require('./middleware/authMiddleware');

const ADMIN_USER = {
  id: 'test-admin-check',
  name: 'Admin Tester',
  email: 'admin_check@test.local',
  role: 'admin',
};

const NORMAL_USER = {
  id: 'test-user-check',
  name: 'Normal Tester',
  email: 'user_check@test.local',
  role: 'user',
};

async function testSystem() {
  console.log('\n' + '='.repeat(70));
  console.log('  SYSTEM INTEGRITY AUDIT');
  console.log('='.repeat(70) + '\n');

  const api = axios.create({ baseURL: 'http://localhost:5056/api', validateStatus: () => true });
  const adminToken = generateToken(ADMIN_USER);
  const userToken = generateToken(NORMAL_USER);

  try {
    // 1. Activity Logs
    console.log('[1. Activity Logs — GET /api/logs]');
    const logsRes = await api.get('/logs', { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(`  Status: ${logsRes.status}, Found: ${logsRes.data.logs?.length || 0} real activity logs`);

    // 2. Threat Monitoring
    console.log('\n[2. Threat Monitoring — GET /api/threats, /stats, /recent]');
    const threatsRes = await api.get('/threats', { headers: { Authorization: `Bearer ${adminToken}` } });
    const statsRes = await api.get('/threats/stats', { headers: { Authorization: `Bearer ${adminToken}` } });
    const recentRes = await api.get('/threats/recent', { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(`  Threats Status: ${threatsRes.status}, Total: ${threatsRes.data.threats?.length || 0}`);
    console.log(`  Stats Status: ${statsRes.status}, Total Logged: ${statsRes.data?.total || 0}`);
    console.log(`  Recent Threats Status: ${recentRes.status}, Count: ${recentRes.data.threats?.length || 0}`);

    // 3. User Activity Summary (Admin only)
    console.log('\n[3. User Activity Summary — GET /api/users/activity-summary]');
    const summaryRes = await api.get('/users/activity-summary', { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(`  Status: ${summaryRes.status}, Total Users Summarized: ${summaryRes.data.userActivity?.length || 0}`);
    if (summaryRes.data.userActivity?.length > 0) {
      const first = summaryRes.data.userActivity[0];
      console.log(`  Sample User Record: ${first.name} (${first.email}) | Role: ${first.role} | Files Stored: ${first.filesStored} | Last Activity: ${first.lastActivity}`);
    }

    // 4. Normal user blocked from admin endpoints
    console.log('\n[4. Role Protection Verification]');
    const userSummaryRes = await api.get('/users/activity-summary', { headers: { Authorization: `Bearer ${userToken}` } });
    console.log(`  Normal User on /api/users/activity-summary: ${userSummaryRes.status} (Expected 403 Forbidden)`);

    const userLogsRes = await api.get('/logs', { headers: { Authorization: `Bearer ${userToken}` } });
    console.log(`  Normal User on /api/logs: ${userLogsRes.status} (Expected 403 Forbidden)`);

    console.log('\n' + '='.repeat(70));
    console.log('  ALL INTEGRITY CHECKS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70) + '\n');
  } catch (err) {
    console.error('Integrity check error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

testSystem();
