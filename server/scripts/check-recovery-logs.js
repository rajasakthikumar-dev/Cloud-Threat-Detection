require('dotenv').config();
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
    }),
  });
}

const db = admin.firestore();

(async () => {
  try {
    console.log('\nChecking file_recovery_logs collection...\n');
    
    const snap = await db.collection('file_recovery_logs').limit(10).get();
    
    if (snap.empty) {
      console.log('✗ No recovery logs found in database');
      console.log('  This is expected if no recovery operations have been performed yet.');
    } else {
      console.log(`✓ Found ${snap.size} recovery log(s):\n`);
      
      snap.docs.forEach((doc, idx) => {
        const data = doc.data();
        console.log(`Record ${idx + 1}:`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  File: ${data.fileName}`);
        console.log(`  User: ${data.userEmail} (${data.userId})`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Completed At: ${data.completedAt?.toDate?.() || data.completedAt}`);
        console.log(`  Integrity Verified: ${data.integrityVerified}`);
        console.log(`  Fields present:`, Object.keys(data).join(', '));
        console.log('');
      });
    }
    
    await admin.app().delete();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
