const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

(async () => {
  try {
    console.log('\n=== TESTING getIntegrityFailures QUERY ===\n');
    
    // Replicate the exact query from getIntegrityFailures
    const snap = await db.collection('activity_logs')
      .where('event_type', '==', 'integrity_failure')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    console.log(`Total integrity failures found: ${snap.size}\n`);
    
    const byUser = {};
    snap.docs.forEach(doc => {
      const d = doc.data();
      const email = d.user_email || d.userEmail || 'unknown';
      if (!byUser[email]) byUser[email] = [];
      byUser[email].push({
        fileName: d.metadata?.fileName || 'unknown',
        time: d.timestamp?.toDate?.() ? d.timestamp.toDate().toLocaleString() : 'N/A',
      });
    });
    
    console.log('Failures by user:');
    Object.entries(byUser).forEach(([email, failures]) => {
      console.log(`\n${email}: ${failures.length} failures`);
      failures.slice(0, 3).forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.fileName} (${f.time})`);
      });
      if (failures.length > 3) {
        console.log(`  ... and ${failures.length - 3} more`);
      }
    });
    
    console.log('\n\n=== TESTING getAllRecoveryLogs (Admin Recovery History) ===\n');
    
    // From firebase.js getAllRecoveryLogs
    const recoverySnap = await db.collection('file_recovery_logs')
      .orderBy('completedAt', 'desc')
      .limit(100)
      .get();
    
    console.log(`Total recovery logs found: ${recoverySnap.size}\n`);
    
    const recoveryByUser = {};
    recoverySnap.docs.forEach(doc => {
      const d = doc.data();
      const email = d.userEmail || d.userId || 'unknown';
      if (!recoveryByUser[email]) recoveryByUser[email] = [];
      recoveryByUser[email].push({
        fileName: d.fileName || 'unknown',
        status: d.status || 'unknown',
      });
    });
    
    console.log('Recoveries by user:');
    Object.entries(recoveryByUser).forEach(([email, recoveries]) => {
      console.log(`\n${email}: ${recoveries.length} recoveries`);
      recoveries.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.fileName} (${r.status})`);
      });
      if (recoveries.length > 3) {
        console.log(`  ... and ${recoveries.length - 3} more`);
      }
    });
    
    await admin.app().delete();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    if (err.message && err.message.includes('index')) {
      console.error('\n⚠ Firestore index missing! This might prevent the query from working.');
    }
    process.exit(1);
  }
})();
