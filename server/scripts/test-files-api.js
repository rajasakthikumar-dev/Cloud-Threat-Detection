require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-key-for-testing';

// User with file that has blockchain status 'recorded'
const testUser = {
  id: '6cf60ede-4d06-42ef-b780-1a96d2bbad18',
  email: 'testuser@example.com',
  role: 'user'
};

const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });

console.log('\n🔍 Testing GET /api/files endpoint');
console.log('═'.repeat(70));
console.log('User ID:', testUser.id);
console.log('Email:', testUser.email);
console.log('');

(async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/files', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const files = response.data.files || [];
    console.log(`✓ API Response Status: ${response.status}`);
    console.log(`✓ Total files returned: ${files.length}\n`);
    
    if (files.length === 0) {
      console.log('⚠️  No files found for this user');
      console.log('   Integrity Verify button will not appear\n');
      process.exit(0);
    }
    
    files.forEach((file, idx) => {
      console.log(`${idx + 1}. ${file.name}`);
      console.log(`   ID: ${file.id}`);
      console.log(`   Key: ${file.key}`);
      console.log(`   Blockchain Status: ${file.blockchainStatus || 'null'} ${file.blockchainStatus === 'recorded' ? '✓' : file.blockchainStatus === 'failed' ? '✗' : '⚠'}`);
      console.log(`   SHA-256: ${file.sha256 ? '✓ Present' : '✗ Missing'}`);
      console.log(`   S3 Version ID: ${file.s3VersionId ? '✓ Present' : '✗ Missing'}`);
      console.log('');
    });
    
    console.log('═'.repeat(70));
    const recorded = files.filter(f => f.blockchainStatus === 'recorded').length;
    const failed = files.filter(f => f.blockchainStatus === 'failed').length;
    const nullStatus = files.filter(f => !f.blockchainStatus).length;
    
    console.log('SUMMARY:');
    console.log(`  ✓ Blockchain recorded:   ${recorded} file(s)`);
    console.log(`  ✗ Blockchain failed:     ${failed} file(s)`);
    console.log(`  ⚠ No blockchain status:  ${nullStatus} file(s)`);
    console.log('═'.repeat(70));
    
    if (recorded > 0) {
      console.log(`\n✓ SUCCESS: Integrity Verify button SHOULD appear for ${recorded} file(s)`);
      console.log('  The button is conditionally rendered when:');
      console.log('    file.blockchainStatus === "recorded"');
    } else {
      console.log('\n✗ ISSUE: NO files with blockchainStatus="recorded"');
      console.log('  The Integrity Verify button WILL NOT appear for any files');
      console.log('  Files must be uploaded with blockchain integration enabled');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ API Request Failed');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
})();
