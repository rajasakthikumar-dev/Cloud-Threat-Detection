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
    console.log('\n=== ADMIN BLOCKCHAIN FILES CHECK ===\n');
    
    // Check all files
    const allFilesSnap = await db.collection('file_metadata').get();
    console.log(`Total files in database: ${allFilesSnap.size}\n`);
    
    const byUser = {};
    const byStatus = {};
    
    allFilesSnap.docs.forEach(doc => {
      const data = doc.data();
      const email = data.user_email || data.userEmail || 'unknown';
      const status = data.blockchainStatus || 'null';
      
      if (!byUser[email]) {
        byUser[email] = { total: 0, recorded: 0, notRecorded: 0 };
      }
      byUser[email].total++;
      if (status === 'recorded') {
        byUser[email].recorded++;
      } else {
        byUser[email].notRecorded++;
      }
      
      if (!byStatus[status]) byStatus[status] = 0;
      byStatus[status]++;
    });
    
    console.log('Files by user:');
    Object.entries(byUser).forEach(([email, counts]) => {
      console.log(`\n${email}:`);
      console.log(`  Total files: ${counts.total}`);
      console.log(`  Blockchain recorded: ${counts.recorded}`);
      console.log(`  Not recorded: ${counts.notRecorded}`);
    });
    
    console.log('\n\nFiles by blockchain status:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Show sample of s@gmail.com files
    console.log('\n=== SAMPLE FILES FOR s@gmail.com ===\n');
    const sFiles = allFilesSnap.docs.filter(doc => {
      const data = doc.data();
      return (data.user_email === 's@gmail.com' || data.userEmail === 's@gmail.com');
    });
    
    console.log(`Found ${sFiles.length} files for s@gmail.com:\n`);
    sFiles.slice(0, 5).forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i + 1}. ${data.name}`);
      console.log(`   blockchainStatus: ${data.blockchainStatus || 'null'}`);
      console.log(`   sha256: ${data.sha256 ? data.sha256.substring(0, 16) + '...' : 'null'}`);
      console.log(`   s3VersionId: ${data.s3VersionId ? data.s3VersionId.substring(0, 20) + '...' : 'null'}`);
      console.log('');
    });
    
    await admin.app().delete();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
