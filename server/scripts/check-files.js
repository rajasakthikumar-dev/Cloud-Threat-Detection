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
    const snap = await db.collection('file_metadata').get();
    console.log(`\nFound ${snap.size} files in Firestore:\n`);
    
    snap.docs.forEach((doc, idx) => {
      const d = doc.data();
      console.log(`File ${idx + 1}:`);
      console.log(`  Firestore ID: ${doc.id}`);
      console.log(`  Name: ${d.name}`);
      console.log(`  Key: ${d.key}`);
      console.log(`  BlockchainStatus: ${d.blockchainStatus || 'null'}`);
      console.log(`  SHA-256: ${d.sha256 || 'null'}`);
      console.log(`  S3 VersionId: ${d.s3VersionId || 'null'}`);
      console.log(`  User ID: ${d.userId}`);
      console.log('');
    });
    
    await admin.app().delete();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
