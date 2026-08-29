/**
 * Firestore Data Audit Script
 * Inspects all Firestore collections to verify real data exists
 */

require('dotenv').config();
const { db, COLLECTIONS } = require('./config/firebase');

async function audit() {
  console.log('\n' + '='.repeat(70));
  console.log('  FIRESTORE DATA AUDIT');
  console.log('='.repeat(70) + '\n');

  try {
    // Check users collection
    const usersSnap = await db.collection(COLLECTIONS.USERS).get();
    console.log(`[USERS] ${usersSnap.size} documents`);
    if (usersSnap.size > 0) {
      usersSnap.docs.slice(0, 5).forEach(doc => {
        const d = doc.data();
        console.log(`  - ${d.email} / ${d.role} / ${d.name}`);
      });
    } else {
      console.log('  ⚠ No users found in Firestore');
    }

    // Check activity_logs collection
    const logsSnap = await db.collection(COLLECTIONS.ACTIVITY_LOGS).get();
    console.log(`\n[ACTIVITY_LOGS] ${logsSnap.size} documents`);
    if (logsSnap.size > 0) {
      logsSnap.docs.slice(0, 5).forEach(doc => {
        const d = doc.data();
        const ts = d.timestamp?.toDate?.()?.toISOString() || 'no timestamp';
        console.log(`  - ${d.event_type} / ${d.user_email} / ${ts}`);
      });
    } else {
      console.log('  ⚠ No activity logs found');
    }

    // Check threat_logs collection
    const threatsSnap = await db.collection(COLLECTIONS.THREAT_LOGS).get();
    console.log(`\n[THREAT_LOGS] ${threatsSnap.size} documents`);
    if (threatsSnap.size > 0) {
      threatsSnap.docs.slice(0, 5).forEach(doc => {
        const d = doc.data();
        console.log(`  - ${d.attack_type} / ${d.risk_level} / ${d.confidence_score}% / ${d.user_email}`);
      });
    } else {
      console.log('  ⚠ No threats logged');
    }

    // Check file_metadata collection
    const filesSnap = await db.collection(COLLECTIONS.FILE_METADATA).get();
    console.log(`\n[FILE_METADATA] ${filesSnap.size} documents`);
    if (filesSnap.size > 0) {
      filesSnap.docs.slice(0, 5).forEach(doc => {
        const d = doc.data();
        console.log(`  - ${d.name} / ${d.size} bytes / ${d.user_email}`);
      });
    } else {
      console.log('  ⚠ No file metadata found');
    }

    console.log('\n' + '='.repeat(70));
    console.log('  SUMMARY');
    console.log('='.repeat(70));
    console.log(`  Users:          ${usersSnap.size}`);
    console.log(`  Activity Logs:  ${logsSnap.size}`);
    console.log(`  Threat Logs:    ${threatsSnap.size}`);
    console.log(`  File Metadata:  ${filesSnap.size}`);
    console.log('='.repeat(70) + '\n');

    process.exit(0);
  } catch (err) {
    console.error('\n✗ Audit failed:', err.message);
    console.error('  Stack:', err.stack);
    process.exit(1);
  }
}

audit();
