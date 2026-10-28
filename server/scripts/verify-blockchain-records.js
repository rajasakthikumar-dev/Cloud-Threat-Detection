require('dotenv').config();
const { queryFileIntegrityRecord } = require('../config/fabricGateway');

const filesToCheck = [
  {
    name: 'integrity-test.txt (File 1)',
    key: 'uploads/4ffea9fd-dad8-48a1-aded-1b6960cfe870/f1f0e29c-cd0c-436e-af38-91bd17e3e521-integrity-test.txt',
    sha256: 'b0b443c7294affb89482fe95007253058b2e82451a00ee014f4cb0fe3d84dae1',
    s3VersionId: 'OJABZFIMCvy.J2lFpT_hdeGQsHgT9XrS',
  },
  {
    name: 'integrity-test.txt (File 3)',
    key: 'uploads/4ffea9fd-dad8-48a1-aded-1b6960cfe870/fa367982-4bac-490b-8fb7-a2cc83e50bdb-integrity-test.txt',
    sha256: 'b4b28ef71853d23a9bedce7cb8dd8083106b4bff9caf9db86154112c8cf6d8b4',
    s3VersionId: 'Ic8oxf4sRFEThJCmhxi8TEpldkYG8Mdv',
  },
];

(async () => {
  console.log('\n========================================');
  console.log('Verifying Blockchain Records');
  console.log('========================================\n');

  for (const file of filesToCheck) {
    const fileId = file.key.replace(/[^a-zA-Z0-9\-_.]/g, '_');
    
    console.log(`📄 ${file.name}`);
    console.log(`   Blockchain FileId: ${fileId}`);
    console.log(`   S3 VersionId: ${file.s3VersionId}`);
    console.log(`   Expected SHA-256: ${file.sha256}`);
    console.log('   Querying blockchain...');
    
    try {
      const result = await queryFileIntegrityRecord(fileId, file.s3VersionId);
      
      if (result.success) {
        const record = result.record;
        console.log('   ✅ BLOCKCHAIN RECORD FOUND');
        console.log(`      Blockchain SHA-256: ${record.sha256}`);
        console.log(`      Timestamp: ${record.timestamp}`);
        
        if (record.sha256 === file.sha256) {
          console.log('   ✅ HASH MATCHES - Record is valid');
        } else {
          console.log('   ❌ HASH MISMATCH!');
          console.log(`      Expected: ${file.sha256}`);
          console.log(`      Got: ${record.sha256}`);
        }
      } else {
        console.log('   ❌ BLOCKCHAIN RECORD NOT FOUND');
        console.log(`      Error: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('========================================\n');
  process.exit(0);
})();
