/**
 * reconcile-blockchain-status.js
 * ──────────────────────────────
 * Reconcile Firestore blockchainStatus with actual blockchain records.
 * 
 * This script:
 * 1. Reads all file metadata from Firestore
 * 2. Identifies files where blockchainStatus is not 'recorded'
 * 3. Queries blockchain to verify if records actually exist
 * 4. Updates Firestore only when blockchain record is confirmed
 * 
 * Usage:
 *   node scripts/reconcile-blockchain-status.js --dry-run
 *   node scripts/reconcile-blockchain-status.js --apply
 */

require('dotenv').config();
const admin = require('firebase-admin');
const { queryFileIntegrityRecord } = require('../config/fabricGateway');

// Initialize Firebase Admin using environment variables
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
const COLLECTIONS = {
  FILE_METADATA: 'file_metadata',
};

async function reconcileBlockchainStatus(dryRun = true) {
  console.log('\n🔍 Blockchain Status Reconciliation');
  console.log('═'.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'APPLY CHANGES'}`);
  console.log('═'.repeat(60));

  const stats = {
    total: 0,
    alreadyRecorded: 0,
    missingMetadata: 0,
    blockchainVerified: 0,
    blockchainMissing: 0,
    blockchainMismatch: 0,
    updated: 0,
    errors: 0,
  };

  try {
    // Get all file metadata
    console.log('\n📂 Reading file metadata from Firestore...');
    const snapshot = await db.collection(COLLECTIONS.FILE_METADATA).get();
    stats.total = snapshot.size;
    console.log(`Found ${stats.total} files\n`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const fileId = data.key ? data.key.replace(/[^a-zA-Z0-9\-_.]/g, '_') : null;

      console.log(`\n📄 File: ${data.name || 'unnamed'}`);
      console.log(`   Firestore ID: ${doc.id}`);
      console.log(`   S3 Key: ${data.key}`);
      console.log(`   Current Status: ${data.blockchainStatus || 'null'}`);

      // Skip if already recorded
      if (data.blockchainStatus === 'recorded') {
        console.log('   ✓ Already marked as recorded');
        stats.alreadyRecorded++;
        continue;
      }

      // Check if file has required metadata
      if (!data.sha256 || !data.s3VersionId || !fileId) {
        console.log('   ⚠ Missing required metadata (sha256, s3VersionId, or key)');
        stats.missingMetadata++;
        continue;
      }

      console.log(`   SHA-256: ${data.sha256}`);
      console.log(`   S3 VersionId: ${data.s3VersionId}`);
      console.log(`   Blockchain FileId: ${fileId}`);

      // Query blockchain
      console.log('   🔗 Querying blockchain...');
      try {
        const result = await queryFileIntegrityRecord(fileId, data.s3VersionId);

        if (!result.success) {
          console.log(`   ✗ Blockchain query failed: ${result.error}`);
          stats.blockchainMissing++;
          continue;
        }

        const record = result.record;
        console.log(`   ✓ Blockchain record found`);
        console.log(`      Blockchain SHA-256: ${record.sha256}`);
        console.log(`      Blockchain S3 Version: ${record.s3VersionId}`);
        console.log(`      Recorded at: ${record.timestamp}`);

        // Verify hash matches
        if (record.sha256 !== data.sha256) {
          console.log(`   ✗ HASH MISMATCH!`);
          console.log(`      Firestore: ${data.sha256}`);
          console.log(`      Blockchain: ${record.sha256}`);
          stats.blockchainMismatch++;
          continue;
        }

        // Verify s3VersionId matches
        if (record.s3VersionId !== data.s3VersionId) {
          console.log(`   ⚠ S3 Version mismatch (blockchain: ${record.s3VersionId})`);
          stats.blockchainMismatch++;
          continue;
        }

        console.log(`   ✓ Blockchain record matches Firestore metadata`);
        stats.blockchainVerified++;

        // Update Firestore
        if (!dryRun) {
          console.log('   📝 Updating blockchainStatus to "recorded"...');
          await doc.ref.update({
            blockchainStatus: 'recorded',
          });
          console.log('   ✓ Updated successfully');
          stats.updated++;
        } else {
          console.log('   → Would update blockchainStatus to "recorded" (dry run)');
        }

      } catch (error) {
        console.log(`   ✗ Error querying blockchain: ${error.message}`);
        stats.errors++;
      }
    }

    // Summary
    console.log('\n\n' + '═'.repeat(60));
    console.log('📊 RECONCILIATION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total files checked:           ${stats.total}`);
    console.log(`Already recorded:              ${stats.alreadyRecorded}`);
    console.log(`Missing required metadata:     ${stats.missingMetadata}`);
    console.log(`Blockchain verified:           ${stats.blockchainVerified}`);
    console.log(`Blockchain missing:            ${stats.blockchainMissing}`);
    console.log(`Blockchain mismatch:           ${stats.blockchainMismatch}`);
    console.log(`Errors:                        ${stats.errors}`);
    
    if (dryRun) {
      console.log(`\n${stats.blockchainVerified} files would be updated (dry run)`);
      console.log('\nTo apply changes, run:');
      console.log('  node scripts/reconcile-blockchain-status.js --apply');
    } else {
      console.log(`\n✓ Successfully updated:        ${stats.updated}`);
    }
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('\n❌ Reconciliation failed:', error.message);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

if (!dryRun && !args.includes('--apply')) {
  console.error('Invalid arguments. Use --dry-run or --apply');
  process.exit(1);
}

// Run reconciliation
reconcileBlockchainStatus(dryRun)
  .then(() => {
    console.log('\n✓ Reconciliation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Reconciliation failed:', error);
    process.exit(1);
  });
