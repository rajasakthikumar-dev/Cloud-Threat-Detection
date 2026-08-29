/**
 * _test_privacy_security.js
 * --------------------------
 * End-to-end multi-user cloud storage and file privacy test suite.
 * Tests strict per-user ownership (User A vs User B vs Admin).
 */

process.env.PORT = '5055';
require('dotenv').config();
const http = require('http');
const FormData = require('form-data');
const axios = require('axios');
const { app, server } = require('./server');
const { generateToken } = require('./middleware/authMiddleware');
const { db, COLLECTIONS, saveUser, deleteUserById } = require('./config/firebase');

const PORT = 5055;
let api;

const USER_A = {
  id: 'user-a-uuid-' + Date.now(),
  name: 'Alice User',
  email: `alice_${Date.now()}@test.local`,
  role: 'user',
  passwordHash: '$2a$12$eXampleHashForTestingUserA...',
};

const USER_B = {
  id: 'user-b-uuid-' + Date.now(),
  name: 'Bob User',
  email: `bob_${Date.now()}@test.local`,
  role: 'user',
  passwordHash: '$2a$12$eXampleHashForTestingUserB...',
};

const ADMIN_USER = {
  id: 'admin-uuid-' + Date.now(),
  name: 'Admin Officer',
  email: `admin_${Date.now()}@test.local`,
  role: 'admin',
  passwordHash: '$2a$12$eXampleHashForTestingAdmin...',
};

let tokenA, tokenB, tokenAdmin;
let fileKeyA, fileKeyB;

const results = [];

function recordTest(name, passed, details = '') {
  results.push({ name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${status} | ${name} ${details ? '(' + details + ')' : ''}`);
}

async function runTests() {
  console.log('\n' + '='.repeat(75));
  console.log('  END-TO-END FILE PRIVACY & AUTHORIZATION TEST SUITE');
  console.log('='.repeat(75) + '\n');

  try {
    const baseURL = `http://localhost:${PORT}/api`;
    api = axios.create({ baseURL, validateStatus: () => true });

    // 2. Setup test users and JWTs
    tokenA = generateToken(USER_A);
    tokenB = generateToken(USER_B);
    tokenAdmin = generateToken(ADMIN_USER);

    // Save test users to Firestore
    try {
      await saveUser(USER_A);
      await saveUser(USER_B);
      await saveUser(ADMIN_USER);
      console.log('✓ Test users initialized in Firestore');
    } catch (e) {
      console.log('Note: Running with direct token auth (Firestore user save optional in test)');
    }

    console.log('\n--- 1. FILE UPLOADS (User A & User B) ---');

    // User A uploads A_private.txt
    const formA = new FormData();
    formA.append('file', Buffer.from('CONFIDENTIAL DATA FOR USER A ONLY'), {
      filename: 'A_private_document.txt',
      contentType: 'text/plain',
    });

    const resUploadA = await api.post('/files/upload', formA, {
      headers: { ...formA.getHeaders(), Authorization: `Bearer ${tokenA}` },
    });

    const uploadAPassed = resUploadA.status === 201 && resUploadA.data?.file?.key;
    fileKeyA = resUploadA.data?.file?.key;
    recordTest('User A Upload File (A_private_document.txt)', uploadAPassed, `Status: ${resUploadA.status}, Key: ${fileKeyA}`);

    // User B uploads B_private.txt
    const formB = new FormData();
    formB.append('file', Buffer.from('CONFIDENTIAL DATA FOR USER B ONLY'), {
      filename: 'B_private_document.txt',
      contentType: 'text/plain',
    });

    const resUploadB = await api.post('/files/upload', formB, {
      headers: { ...formB.getHeaders(), Authorization: `Bearer ${tokenB}` },
    });

    const uploadBPassed = resUploadB.status === 201 && resUploadB.data?.file?.key;
    fileKeyB = resUploadB.data?.file?.key;
    recordTest('User B Upload File (B_private_document.txt)', uploadBPassed, `Status: ${resUploadB.status}, Key: ${fileKeyB}`);

    console.log('\n--- 2. FILE LIST PRIVACY (GET /api/files) ---');

    // User A lists files
    const resListA = await api.get('/files', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const filesA = resListA.data.files || [];
    const aSeesOwn = filesA.some(f => f.key === fileKeyA);
    const aDoesNotSeeB = !filesA.some(f => f.key === fileKeyB);
    recordTest('User A sees User A files', aSeesOwn, `Found ${filesA.length} files`);
    recordTest('User A CANNOT see User B files', aDoesNotSeeB, 'User B file isolated');

    // User B lists files
    const resListB = await api.get('/files', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const filesB = resListB.data.files || [];
    const bSeesOwn = filesB.some(f => f.key === fileKeyB);
    const bDoesNotSeeA = !filesB.some(f => f.key === fileKeyA);
    recordTest('User B sees User B files', bSeesOwn, `Found ${filesB.length} files`);
    recordTest('User B CANNOT see User A files', bDoesNotSeeA, 'User A file isolated');

    // Admin lists files (Admin My Files must NOT contain user files)
    const resListAdmin = await api.get('/files', {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const filesAdmin = resListAdmin.data.files || [];
    const adminDoesNotSeeA = !filesAdmin.some(f => f.key === fileKeyA);
    const adminDoesNotSeeB = !filesAdmin.some(f => f.key === fileKeyB);
    recordTest('Admin My Files CANNOT see User A private files', adminDoesNotSeeA, 'User A file isolated from Admin');
    recordTest('Admin My Files CANNOT see User B private files', adminDoesNotSeeB, 'User B file isolated from Admin');

    console.log('\n--- 3. DOWNLOAD AUTHORIZATION (GET /api/files/download/:key) ---');

    // User A downloads User A file -> 200 OK
    const resDlA = await api.get(`/files/download/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    recordTest('User A can download own file', resDlA.status === 200 && !!resDlA.data?.url, `Status: ${resDlA.status}`);

    // User B tries to download User A file -> 403 Forbidden
    const resDlB_on_A = await api.get(`/files/download/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    recordTest('User B REJECTED when downloading User A file (403 Forbidden)', resDlB_on_A.status === 403, `Status: ${resDlB_on_A.status}`);

    // Admin tries to download User A file -> 403 Forbidden
    const resDlAdmin_on_A = await api.get(`/files/download/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    recordTest('Admin REJECTED when downloading User A file (403 Forbidden)', resDlAdmin_on_A.status === 403, `Status: ${resDlAdmin_on_A.status}`);

    console.log('\n--- 4. PREVIEW AUTHORIZATION (GET /api/files/preview/:key) ---');

    // User A previews User A file -> 200 OK
    const resPrevA = await api.get(`/files/preview/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    recordTest('User A can preview own file', resPrevA.status === 200 && !!resPrevA.data?.url, `Status: ${resPrevA.status}`);

    // User B tries to preview User A file -> 403 Forbidden
    const resPrevB_on_A = await api.get(`/files/preview/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    recordTest('User B REJECTED when previewing User A file (403 Forbidden)', resPrevB_on_A.status === 403, `Status: ${resPrevB_on_A.status}`);

    // Admin tries to preview User A file -> 403 Forbidden
    const resPrevAdmin_on_A = await api.get(`/files/preview/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    recordTest('Admin REJECTED when previewing User A file (403 Forbidden)', resPrevAdmin_on_A.status === 403, `Status: ${resPrevAdmin_on_A.status}`);

    console.log('\n--- 5. DIRECT CONTENT STREAMING AUTHORIZATION (GET /api/files/content/:key) ---');

    // User A views content -> 200 OK with content
    const resContentA = await api.get(`/files/content/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    recordTest('User A can stream own file content', resContentA.status === 200 && String(resContentA.data).includes('CONFIDENTIAL DATA FOR USER A ONLY'), `Status: ${resContentA.status}`);

    // User B tries to stream User A content -> 403 Forbidden
    const resContentB_on_A = await api.get(`/files/content/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    recordTest('User B REJECTED when streaming User A content (403 Forbidden)', resContentB_on_A.status === 403, `Status: ${resContentB_on_A.status}`);

    // Admin tries to stream User A content -> 403 Forbidden
    const resContentAdmin_on_A = await api.get(`/files/content/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    recordTest('Admin REJECTED when streaming User A content (403 Forbidden)', resContentAdmin_on_A.status === 403, `Status: ${resContentAdmin_on_A.status}`);

    console.log('\n--- 6. DELETE AUTHORIZATION (DELETE /api/files/:key) ---');

    // User B tries to delete User A file -> 403 Forbidden
    const resDelB_on_A = await api.delete(`/files/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    recordTest('User B REJECTED when deleting User A file (403 Forbidden)', resDelB_on_A.status === 403, `Status: ${resDelB_on_A.status}`);

    // Admin tries to delete User A file -> 403 Forbidden
    const resDelAdmin_on_A = await api.delete(`/files/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    recordTest('Admin REJECTED when deleting User A file (403 Forbidden)', resDelAdmin_on_A.status === 403, `Status: ${resDelAdmin_on_A.status}`);

    console.log('\n--- 7. ADMIN USER ACTIVITY SECTION (GET /api/users/activity-summary) ---');

    // Non-admin (User A) requests user activity summary -> 403 Forbidden
    const resSummaryUser = await api.get('/users/activity-summary', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    recordTest('Non-admin REJECTED from /api/users/activity-summary (403 Forbidden)', resSummaryUser.status === 403, `Status: ${resSummaryUser.status}`);

    // Admin requests user activity summary -> 200 OK
    const resSummaryAdmin = await api.get('/users/activity-summary', {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const userActivity = resSummaryAdmin.data.userActivity || [];
    const hasUsers = userActivity.length > 0;
    const userARecord = userActivity.find(u => u.id === USER_A.id || u.email === USER_A.email);
    const hasFilesCount = userARecord && typeof userARecord.filesStored === 'number';
    recordTest('Admin accesses /api/users/activity-summary (200 OK)', resSummaryAdmin.status === 200 && hasUsers, `Found ${userActivity.length} users`);
    recordTest('User Activity contains calculated file counts', hasFilesCount, `User A filesStored: ${userARecord?.filesStored}`);

    console.log('\n--- 8. AUTHORIZED CLEANUP DELETION ---');

    // User A deletes own file -> 200 OK
    const resDelA = await api.delete(`/files/${encodeURIComponent(fileKeyA)}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    recordTest('User A deletes own file (200 OK)', resDelA.status === 200, `Status: ${resDelA.status}`);

    // User B deletes own file -> 200 OK
    const resDelB = await api.delete(`/files/${encodeURIComponent(fileKeyB)}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    recordTest('User B deletes own file (200 OK)', resDelB.status === 200, `Status: ${resDelB.status}`);

    // Clean up test users
    try {
      await deleteUserById(USER_A.id);
      await deleteUserById(USER_B.id);
      await deleteUserById(ADMIN_USER.id);
    } catch (_) {}

  } catch (err) {
    console.error('Test execution error:', err.message);
  } finally {
    if (server) {
      server.close();
    }

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    console.log('\n' + '='.repeat(75));
    console.log(`  FINAL RESULTS: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length} tests`);
    console.log('='.repeat(75) + '\n');

    process.exit(failedCount === 0 ? 0 : 1);
  }
}

runTests();
