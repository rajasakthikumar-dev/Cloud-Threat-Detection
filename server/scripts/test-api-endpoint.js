require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-key-for-testing';
const API_URL = 'http://localhost:5000/api/files/recovery-history';

// Generate a test token for the user with recovery logs
const testUser = {
  id: '96e86cc4-cea6-4f4f-95ba-15487a7805db',
  email: 's@gmail.com',
  role: 'user'
};

const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });

console.log('\nTesting API Endpoint: GET /api/files/recovery-history\n');
console.log('User:', testUser.email);
console.log('Token generated:', token.substring(0, 50) + '...\n');

(async () => {
  try {
    const response = await axios.get(API_URL, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✓ API Response Status:', response.status);
    console.log('✓ Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    const recoveries = response.data.recoveries || [];
    console.log(`\n✓ Total recovery records: ${recoveries.length}`);
    
    if (recoveries.length > 0) {
      console.log('\nFirst 3 records:');
      recoveries.slice(0, 3).forEach((r, i) => {
        console.log(`\n${i + 1}. ${r.fileName || r.fileKey}`);
        console.log(`   Status: ${r.status}`);
        console.log(`   Date: ${r.completedAt || r.startedAt}`);
        console.log(`   Original Hash: ${r.trustedOriginalSha256?.substring(0, 16)}...`);
        console.log(`   Restored Hash: ${r.restoredSha256?.substring(0, 16)}...`);
        console.log(`   Blockchain TX: ${r.blockchainTransactionId ? 'Yes' : 'No'}`);
      });
    }
    
    console.log('\n✓ API TEST PASSED!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ API TEST FAILED!');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
})();
