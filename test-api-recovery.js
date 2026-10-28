const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const { getRecoveryLogsByUser } = require('./server/config/firebase');

(async () => {
  try {
    console.log('\n=== TESTING getRecoveryLogsByUser with file existence check ===\n');
    
    const userId = '96e86cc4-cea6-4f4f-95ba-15487a7805db'; // From test data
    
    const logs = await getRecoveryLogsByUser(userId, 50);
    
    console.log(`Total recovery records returned: ${logs.length}\n`);
    
    if (logs.length > 0) {
      console.log('Records that WILL BE SHOWN to user:\n');
      logs.forEach((log, i) => {
        console.log(`${i + 1}. ${log.fileName}`);
        console.log(`   Status: ${log.status}`);
        console.log(`   FileKey: ${log.fileKey}`);
        console.log(`   Deleted flag: ${log.deleted || 'undefined'}`);
        console.log('');
      });
    } else {
      console.log('No recovery records will be shown (all filtered out).');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
