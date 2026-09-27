/**
 * test-fabric-connection.js
 * -------------------------
 * Test Fabric Gateway connection and chaincode interaction directly.
 */

const { submitFileIntegrityRecord, queryFileIntegrityRecord } = require('./server/config/fabricGateway');
const crypto = require('crypto');

async function testFabricConnection() {
  console.log('🚀 Testing Fabric Gateway Connection');
  console.log('=' .repeat(50));

  // Test data
  const testFileData = {
    fileId: 'test-file-' + Date.now(),
    fileName: 'test-blockchain-integration.txt',
    ownerId: 'test-user-123',
    s3Key: 'uploads/test-user-123/test-blockchain-integration.txt',
    s3VersionId: 'test-version-' + Date.now(),
    sha256: crypto.createHash('sha256').update('test file content ' + Date.now()).digest('hex'),
  };

  console.log('📝 Test file data:');
  console.log('   File ID:', testFileData.fileId);
  console.log('   File Name:', testFileData.fileName);
  console.log('   Owner ID:', testFileData.ownerId);
  console.log('   S3 Key:', testFileData.s3Key);
  console.log('   S3 Version:', testFileData.s3VersionId);
  console.log('   SHA-256:', testFileData.sha256);

  try {
    // Test 1: Submit record to blockchain
    console.log('\n📤 Testing blockchain record submission...');
    const submitResult = await submitFileIntegrityRecord(testFileData);
    
    if (submitResult.success) {
      console.log('✅ Blockchain record created successfully!');
      console.log('   Transaction ID:', submitResult.transactionId);
    } else {
      console.log('❌ Blockchain record creation failed:', submitResult.error);
      return;
    }

    // Test 2: Query record from blockchain
    console.log('\n🔍 Testing blockchain record query...');
    const queryResult = await queryFileIntegrityRecord(testFileData.fileId, testFileData.s3VersionId);
    
    if (queryResult.success) {
      console.log('✅ Blockchain record retrieved successfully!');
      console.log('   Record:');
      console.log('     File ID:', queryResult.record.fileId);
      console.log('     File Name:', queryResult.record.fileName);
      console.log('     Owner ID:', queryResult.record.ownerId);
      console.log('     S3 Key:', queryResult.record.s3Key);
      console.log('     S3 Version:', queryResult.record.s3VersionId);
      console.log('     SHA-256:', queryResult.record.sha256);
      console.log('     Timestamp:', queryResult.record.timestamp);
      console.log('     Transaction ID:', queryResult.record.txId);
    } else {
      console.log('❌ Blockchain record query failed:', queryResult.error);
      return;
    }

    console.log('\n✅ All Fabric Gateway tests passed!');

  } catch (error) {
    console.log('❌ Fabric Gateway test failed:', error.message);
  }
  
  console.log('=' .repeat(50));
}

// Run the test
testFabricConnection().catch(console.error);