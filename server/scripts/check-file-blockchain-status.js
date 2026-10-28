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
const userId = '96e86cc4-cea6-4f4f-95ba-15487a7805db';

(async () => {
  try {
    console.log('\n📁 Checking file metadata blockchain status...\n');
    
    const snap = await db.collection('file_metadata')
      .where('userId', '==', userId)
      .limit(15)
      .get();
    
    console.log(`Found ${snap.size} files for user s@gmail.com\n`);
    
    let recorded = 0, failed = 0, nullStatus = 0;
    
    snap.docs.forEach((doc, idx) => {
      const data = doc.data();
      const status = data.blockchainStatus;
      
      if (status === 'recorded') recorded++;
      else if (status === 'failed') failed++;
      else nullStatus++;
      
      console.log(`${idx + 1}. ${data.name}`);
      console.log(`   Status: ${status || 'null'} ${status === 'recorded' ? '✓' : status === 'failed' ? '✗' : '⚠'}`);
      console.log(`   SHA-256: ${data.sha256 ? '✓ Present' : '✗ Missing'}`);
      console.log(`   S3 Version: ${data.s3VersionId ? '✓ Present' : '✗ Missing'}`);
      console.log('');
    });
    
    console.log('═'.repeat(60));
    console.log('SUMMARY:');
    console.log(`  ✓ Blockchain recorded: ${recorded} files`);
    console.log(`  ✗ Blockchain failed:   ${failed} files`);
    console.log(`  ⚠ No blockchain status: ${nullStatus} files`);
    console.log('═'.repeat(60));
    
    if (recorded === 0) {
      console.log('\n⚠️  WARNING: NO FILES WITH blockchainStatus="recorded"');
      console.log('   The Integrity Verify button will NOT appear for any files!');
    } else {
      console.log(`\n✓ Integrity Verify button SHOULD appear for ${recorded} file(s)`);
    }
    
    await admin.app().delete();
    process.exit(0);
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
})();
