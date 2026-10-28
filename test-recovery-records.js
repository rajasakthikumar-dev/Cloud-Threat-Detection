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
    console.log('\n=== RECOVERY LOGS CHECK ===\n');
    
    const recoverySnap = await db.collection('file_recovery_logs').get();
    console.log(`Total recovery records: ${recoverySnap.size}\n`);
    
    const byUser = {};
    recoverySnap.docs.forEach(doc => {
      const data = doc.data();
      const email = data.userEmail || 'unknown';
      if (!byUser[email]) {
        byUser[email] = { total: 0, deleted: 0, notDeleted: 0 };
      }
      byUser[email].total++;
      if (data.deleted) {
        byUser[email].deleted++;
      } else {
        byUser[email].notDeleted++;
      }
    });
    
    console.log('Recovery records by user:');
    Object.entries(byUser).forEach(([email, counts]) => {
      console.log(`\n${email}:`);
      console.log(`  Total: ${counts.total}`);
      console.log(`  Marked deleted: ${counts.deleted}`);
      console.log(`  NOT marked deleted: ${counts.notDeleted}`);
    });
    
    // Show sample of NOT deleted records
    console.log('\n=== SAMPLE OF NOT-DELETED RECORDS ===\n');
    let shown = 0;
    recoverySnap.docs.forEach(doc => {
      if (!doc.data().deleted && shown < 5) {
        const data = doc.data();
        console.log(`Record ID: ${doc.id}`);
        console.log(`  fileName: ${data.fileName}`);
        console.log(`  fileKey: ${data.fileKey}`);
        console.log(`  fileId: ${data.fileId}`);
        console.log(`  userId: ${data.userId}`);
        console.log(`  status: ${data.status}`);
        console.log(`  deleted: ${data.deleted || 'UNDEFINED'}`);
        console.log('');
        shown++;
      }
    });
    
    // Check if any corresponding files still exist
    console.log('\n=== CHECKING FILE EXISTENCE ===\n');
    const notDeletedRecords = recoverySnap.docs.filter(doc => !doc.data().deleted);
    for (const doc of notDeletedRecords.slice(0, 5)) {
      const data = doc.data();
      const fileSnap = await db.collection('file_metadata')
        .where('key', '==', data.fileKey)
        .limit(1)
        .get();
      
      console.log(`Recovery: ${data.fileName}`);
      console.log(`  File exists in file_metadata: ${!fileSnap.empty ? 'YES' : 'NO'}`);
      if (!fileSnap.empty) {
        console.log(`  File owner: ${fileSnap.docs[0].data().userId}`);
        console.log(`  Recovery owner: ${data.userId}`);
      }
      console.log('');
    }
    
    await admin.app().delete();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
