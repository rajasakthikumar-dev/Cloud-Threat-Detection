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
    console.log('\n=== ACTIVITY CHECK FOR s@gmail.com ===\n');
    
    // Check users collection
    const usersSnap = await db.collection('users').get();
    console.log('All users in database:');
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.email} (${data.role})`);
    });
    
    // Check activity logs for s@gmail.com
    const activitySnap = await db.collection('activity_logs')
      .where('user_email', '==', 's@gmail.com')
      .get();
    
    console.log(`\n\nActivity logs for s@gmail.com: ${activitySnap.size} events`);
    
    if (activitySnap.size > 0) {
      const eventTypes = {};
      activitySnap.docs.forEach(doc => {
        const data = doc.data();
        const type = data.event_type || 'unknown';
        if (!eventTypes[type]) eventTypes[type] = 0;
        eventTypes[type]++;
      });
      
      console.log('\nEvent types:');
      Object.entries(eventTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
      
      console.log('\nRecent activities:');
      activitySnap.docs.slice(0, 10).forEach(doc => {
        const data = doc.data();
        console.log(`\n  Event: ${data.event_type}`);
        console.log(`  Time: ${data.timestamp?.toDate?.() ? data.timestamp.toDate().toLocaleString() : 'N/A'}`);
        console.log(`  Details: ${data.details}`);
        if (data.metadata && data.metadata.fileName) {
          console.log(`  File: ${data.metadata.fileName}`);
        }
      });
    }
    
    await admin.app().delete();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
