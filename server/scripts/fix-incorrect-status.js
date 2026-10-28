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

// These two files have blockchainStatus='recorded' but no blockchain records exist
const filesToFix = [
  'JvwcP0iHBH4qx9Dy0iGm',  // File 1
  'UC1jt6gtynuN55RRzn0G',  // File 3
];

(async () => {
  console.log('\nCorrecting incorrect blockchainStatus values...\n');
  
  for (const docId of filesToFix) {
    const docRef = db.collection('file_metadata').doc(docId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      const data = doc.data();
      console.log(`File: ${data.name}`);
      console.log(`  Current status: ${data.blockchainStatus}`);
      console.log(`  Updating to: null (no blockchain record exists)`);
      
      await docRef.update({
        blockchainStatus: null
      });
      
      console.log(`  ✅ Updated\n`);
    }
  }
  
  console.log('✅ Metadata corrected\n');
  await admin.app().delete();
  process.exit(0);
})();
