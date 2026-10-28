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
    const userId = '96e86cc4-cea6-4f4f-95ba-15487a7805db';
    
    console.log('\n1. Testing query WITHOUT orderBy (should work)...');
    const snap1 = await db.collection('file_recovery_logs')
      .where('userId', '==', userId)
      .limit(10)
      .get();
    console.log(`   ✓ Found ${snap1.size} records\n`);
    
    console.log('2. Testing query WITH orderBy (may require index)...');
    try {
      const snap2 = await db.collection('file_recovery_logs')
        .where('userId', '==', userId)
        .orderBy('completedAt', 'desc')
        .limit(10)
        .get();
      console.log(`   ✓ Found ${snap2.size} records`);
      console.log('   ✓ Index exists! Query works fine.\n');
    } catch (err) {
      if (err.message.includes('index') || err.code === 9) {
        console.log('   ✗ INDEX MISSING!');
        console.log('   Error:', err.message);
        console.log('\n   The query requires a composite Firestore index.');
        console.log('   Please create an index for:');
        console.log('     Collection: file_recovery_logs');
        console.log('     Fields: userId (Ascending), completedAt (Descending)\n');
      } else {
        throw err;
      }
    }
    
    await admin.app().delete();
    process.exit(0);
  } catch (error) {
    console.error('\nUnexpected error:', error.message);
    process.exit(1);
  }
})();
