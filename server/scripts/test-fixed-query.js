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
    
    console.log('\nTesting fixed query (without orderBy)...\n');
    
    const snap = await db.collection('file_recovery_logs')
      .where('userId', '==', userId)
      .limit(10)
      .get();
    
    console.log(`✓ Query successful! Found ${snap.size} records\n`);
    
    // Sort in-memory
    const docs = snap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        _sortKey: data.completedAt?.toMillis?.() || data.startedAt?.toMillis?.() || 0,
      };
    });
    
    docs.sort((a, b) => b._sortKey - a._sortKey);
    
    console.log('Records sorted by date (newest first):\n');
    docs.slice(0, 5).forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.fileName}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Date: ${doc.completedAt?.toDate?.()}`);
      console.log(`   User: ${doc.userEmail}`);
      console.log('');
    });
    
    await admin.app().delete();
    process.exit(0);
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
})();
