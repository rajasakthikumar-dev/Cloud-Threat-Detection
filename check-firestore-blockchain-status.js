#!/usr/bin/env node

/**
 * check-firestore-blockchain-status.js
 * -------------------------------------
 * Diagnostic script to query Firestore and inspect file metadata.
 * 
 * This script verifies whether uploaded files have the required
 * blockchain metadata fields (blockchainStatus, sha256, s3VersionId)
 * needed for the Integrity Verify button to appear.
 * 
 * Usage:
 *   node check-firestore-blockchain-status.js [userId]
 * 
 * If userId is omitted, checks ALL files in the database.
 */

const { db, COLLECTIONS } = require('./server/config/firebase');

async function checkBlockchainStatus(userId = null) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  FIRESTORE BLOCKCHAIN STATUS CHECK');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  
  try {
    // Build query
    let query = db.collection(COLLECTIONS.FILE_METADATA);
    
    if (userId) {
      console.log(`Querying files for userId: ${userId}`);
      query = query.where('userId', '==', userId);
    } else {
      console.log('Querying ALL files in database (no userId filter)');
    }
    
    const snap = await query.get();
    
    if (snap.empty) {
      console.log('✗ No files found in Firestore.');
      console.log('');
      console.log('Possible reasons:');
      console.log('  1. No files have been uploaded yet');
      console.log('  2. Incorrect userId provided');
      console.log('  3. Firebase credentials not configured');
      console.log('');
      process.exit(0);
    }
    
    console.log(`✓ Found ${snap.size} file(s) in Firestore`);
    console.log('');
    
    // Statistics
    let withBlockchainStatus = 0;
    let blockchainRecorded = 0;
    let blockchainFailed = 0;
    let blockchainNull = 0;
    let withSha256 = 0;
    let withS3VersionId = 0;
    let fullyCompliant = 0; // Has all three required fields
    
    // Detailed results
    const results = [];
    
    snap.forEach(doc => {
      const data = doc.data();
      const fileId = doc.id;
      
      const hasBlockchainStatus = data.blockchainStatus !== undefined;
      const hasSha256 = data.sha256 !== undefined && data.sha256 !== null;
      const hasS3VersionId = data.s3VersionId !== undefined && data.s3VersionId !== null;
      
      if (hasBlockchainStatus) withBlockchainStatus++;
      if (data.blockchainStatus === 'recorded') blockchainRecorded++;
      if (data.blockchainStatus === 'failed') blockchainFailed++;
      if (data.blockchainStatus === null || data.blockchainStatus === undefined) blockchainNull++;
      if (hasSha256) withSha256++;
      if (hasS3VersionId) withS3VersionId++;
      if (hasBlockchainStatus && data.blockchainStatus === 'recorded' && hasSha256 && hasS3VersionId) {
        fullyCompliant++;
      }
      
      results.push({
        fileId,
        fileName: data.name || 'unknown',
        key: data.key || 'unknown',
        userId: data.userId || 'unknown',
        userEmail: data.user_email || data.userEmail || 'unknown',
        blockchainStatus: data.blockchainStatus,
        hasSha256,
        hasS3VersionId,
        uploadedAt: data.uploadedAt?.toDate?.() || null,
      });
    });
    
    // Display statistics
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('  STATISTICS');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`Total files:                    ${snap.size}`);
    console.log(`Files with blockchainStatus:    ${withBlockchainStatus} (${((withBlockchainStatus/snap.size)*100).toFixed(1)}%)`);
    console.log(`  └─ Status = 'recorded':       ${blockchainRecorded} (${((blockchainRecorded/snap.size)*100).toFixed(1)}%)`);
    console.log(`  └─ Status = 'failed':         ${blockchainFailed} (${((blockchainFailed/snap.size)*100).toFixed(1)}%)`);
    console.log(`  └─ Status = null/missing:     ${blockchainNull} (${((blockchainNull/snap.size)*100).toFixed(1)}%)`);
    console.log('');
    console.log(`Files with SHA-256 hash:        ${withSha256} (${((withSha256/snap.size)*100).toFixed(1)}%)`);
    console.log(`Files with S3 VersionId:        ${withS3VersionId} (${((withS3VersionId/snap.size)*100).toFixed(1)}%)`);
    console.log('');
    console.log(`Fully compliant (button shows): ${fullyCompliant} (${((fullyCompliant/snap.size)*100).toFixed(1)}%)`);
    console.log('');
    
    // Display detailed results
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('  DETAILED RESULTS');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('');
    
    // Sort by uploadedAt descending (most recent first)
    results.sort((a, b) => {
      const timeA = a.uploadedAt ? a.uploadedAt.getTime() : 0;
      const timeB = b.uploadedAt ? b.uploadedAt.getTime() : 0;
      return timeB - timeA;
    });
    
    results.forEach((file, index) => {
      const buttonWillShow = file.blockchainStatus === 'recorded' && file.hasSha256 && file.hasS3VersionId;
      const icon = buttonWillShow ? '✓' : '✗';
      const color = buttonWillShow ? '\x1b[32m' : '\x1b[31m'; // Green or Red
      const reset = '\x1b[0m';
      
      console.log(`${color}${icon}${reset} File #${index + 1}: ${file.fileName}`);
      console.log(`   Firestore ID:      ${file.fileId}`);
      console.log(`   S3 Key:            ${file.key}`);
      console.log(`   User:              ${file.userEmail} (${file.userId})`);
      console.log(`   blockchainStatus:  ${file.blockchainStatus === undefined ? 'undefined' : (file.blockchainStatus === null ? 'null' : `'${file.blockchainStatus}'`)}`);
      console.log(`   SHA-256 present:   ${file.hasSha256 ? 'Yes' : 'No'}`);
      console.log(`   S3 VersionId:      ${file.hasS3VersionId ? 'Yes' : 'No'}`);
      console.log(`   Uploaded:          ${file.uploadedAt ? file.uploadedAt.toISOString() : 'unknown'}`);
      console.log(`   ${color}Button visible:    ${buttonWillShow ? 'YES' : 'NO'}${reset}`);
      console.log('');
    });
    
    // Recommendations
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    
    if (fullyCompliant === snap.size) {
      console.log('✓ ALL files are fully compliant!');
      console.log('  If the button still does not appear:');
      console.log('    1. Check browser console for JavaScript errors');
      console.log('    2. Verify React component is receiving correct props');
      console.log('    3. Inspect DOM to confirm button element is not rendered');
      console.log('    4. Check that frontend API call returns blockchainStatus field');
    } else if (blockchainRecorded === 0) {
      console.log('✗ NO files have blockchainStatus = "recorded"');
      console.log('');
      console.log('ROOT CAUSE: Blockchain integration is not working.');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Check if Fabric network is running:');
      console.log('     cd blockchain/fabric-samples/test-network');
      console.log('     docker ps -a | grep hyperledger');
      console.log('');
      console.log('  2. Test Fabric connectivity from Node.js:');
      console.log('     cd server');
      console.log('     node -e "require(\'./config/fabricGateway\').getContract().then(() => console.log(\'Connected\')).catch(e => console.error(\'Failed:\', e.message))"');
      console.log('');
      console.log('  3. Upload a new test file and monitor server logs:');
      console.log('     tail -f server/logs/*.log | grep -i blockchain');
      console.log('');
      console.log('  4. Check for Fabric errors in server console output');
    } else if (blockchainFailed > 0) {
      console.log(`⚠ ${blockchainFailed} file(s) have blockchainStatus = "failed"`);
      console.log('');
      console.log('This means blockchain transactions were attempted but failed.');
      console.log('');
      console.log('Possible causes:');
      console.log('  • Fabric network was down during upload');
      console.log('  • Chaincode invocation error');
      console.log('  • TLS certificate issues');
      console.log('  • Network timeout');
      console.log('');
      console.log('These files cannot be integrity-verified unless re-uploaded.');
    } else {
      console.log(`⚠ ${snap.size - fullyCompliant} file(s) lack required metadata`);
      console.log('');
      console.log('Legacy files (uploaded before blockchain integration):');
      console.log('  • Cannot be retroactively verified');
      console.log('  • Must be re-uploaded to gain blockchain protection');
      console.log('');
      console.log('Files with failed blockchain status:');
      console.log('  • Fabric network issue during upload');
      console.log('  • Must be re-uploaded after fixing blockchain connectivity');
    }
    
    console.log('');
    process.exit(0);
    
  } catch (error) {
    console.error('✗ Error querying Firestore:', error.message);
    console.error('');
    console.error('Possible issues:');
    console.error('  • Firebase credentials not configured');
    console.error('  • Invalid service account key');
    console.error('  • Network connectivity issue');
    console.error('  • Firestore security rules blocking read access');
    console.error('');
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const userId = process.argv[2] || null;

checkBlockchainStatus(userId);
