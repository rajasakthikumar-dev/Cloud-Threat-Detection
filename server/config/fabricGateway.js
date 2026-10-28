/**
 * config/fabricGateway.js
 * -------------------------
 * Hyperledger Fabric Gateway connection for file integrity records.
 * 
 * Connects to existing local Fabric network:
 * - Channel: mychannel
 * - Chaincode: file-integrity
 * - Organization: Org1MSP
 * - Identity: User1@org1.example.com
 * 
 * Uses the modern @hyperledger/fabric-gateway API.
 */

const { Gateway, connect, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration - uses environment variables where practical
const FABRIC_CONFIG = {
  // Network endpoints
  peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
  
  // MSP and identity
  mspId: process.env.FABRIC_MSP_ID || 'Org1MSP',
  
  // Channel and chaincode
  channelName: process.env.FABRIC_CHANNEL || 'mychannel',
  chaincodeName: process.env.FABRIC_CHAINCODE || 'file-integrity',
  
  // Base path for certificates (can be overridden via env var)
  basePath: process.env.FABRIC_BASE_PATH || path.join(__dirname, '../../blockchain/fabric-samples/test-network'),
};

// Cached connection to avoid reopening for every request
let gatewayInstance = null;
let contractInstance = null;

/**
 * Get the path to a certificate or key file
 */
function getCertPath(relativePath) {
  return path.join(FABRIC_CONFIG.basePath, relativePath);
}

/**
 * Read certificate/key file
 */
function readCryptoFile(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    throw new Error(`Failed to read crypto file ${filePath}: ${error.message}`);
  }
}

/**
 * Create gRPC client connection to peer
 */
function newGrpcConnection() {
  const tlsRootCert = readCryptoFile(getCertPath(
    'organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt'
  ));
  
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(FABRIC_CONFIG.peerEndpoint, tlsCredentials);
}

/**
 * Create identity for User1@org1.example.com  
 */
function newIdentity() {
  const certPath = getCertPath(
    'organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/cert.pem'
  );
  
  const credentials = readCryptoFile(certPath);
  
  return { 
    mspId: FABRIC_CONFIG.mspId, 
    credentials 
  };
}

/**
 * Create signer for transactions using official signers utility
 */
function newSigner() {
  const keyDir = getCertPath(
    'organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore'  
  );
  
  const keyFiles = fs.readdirSync(keyDir).filter(f => f.endsWith('_sk'));
  if (keyFiles.length === 0) {
    throw new Error(`No private key file found in ${keyDir}`);
  }
  
  const keyPath = path.join(keyDir, keyFiles[0]);
  const privateKeyPem = readCryptoFile(keyPath);
  
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

/**
 * Get or create Gateway connection
 */
async function getGateway() {
  if (gatewayInstance) {
    return gatewayInstance;
  }
  
  try {
    const client = newGrpcConnection();
    const identity = newIdentity();
    const signer = newSigner();
    
    // Add debug logging
    console.log('[fabricGateway] Connecting with:');
    console.log('  MSP ID:', identity.mspId);
    console.log('  Peer Endpoint:', FABRIC_CONFIG.peerEndpoint);
    console.log('  Channel:', FABRIC_CONFIG.channelName);
    console.log('  Chaincode:', FABRIC_CONFIG.chaincodeName);
    
    gatewayInstance = connect({
      client,
      identity,
      signer,
    });
    
    console.log('[fabricGateway] Successfully connected to Fabric network');
    return gatewayInstance;
  } catch (error) {
    console.error('[fabricGateway] Failed to connect to Fabric network:', error.message);
    throw error;
  }
}

/**
 * Get the file-integrity contract instance
 */
async function getContract() {
  if (contractInstance) {
    return contractInstance;
  }
  
  const gateway = await getGateway();
  const network = gateway.getNetwork(FABRIC_CONFIG.channelName);
  contractInstance = network.getContract(FABRIC_CONFIG.chaincodeName);
  
  return contractInstance;
}

/**
 * Submit file integrity record to blockchain
 * 
 * @param {Object} fileData - File integrity data
 * @param {string} fileData.fileId - Application file identifier
 * @param {string} fileData.fileName - Original filename
 * @param {string} fileData.ownerId - User/owner ID
 * @param {string} fileData.s3Key - S3 object key
 * @param {string} fileData.s3VersionId - S3 version ID
 * @param {string} fileData.sha256 - File SHA-256 hash
 * @returns {Promise<Object>} Transaction result
 */
async function submitFileIntegrityRecord(fileData) {
  try {
    const { fileId, fileName, ownerId, s3Key, s3VersionId, sha256 } = fileData;
    
    // Validate required fields
    if (!fileId || !fileName || !ownerId || !s3Key || !s3VersionId || !sha256) {
      throw new Error('Missing required fields for blockchain record');
    }
    
    const contract = await getContract();
    
    // Submit transaction to CreateFileIntegrityRecord function
    const result = await contract.submitTransaction(
      'CreateFileIntegrityRecord',
      fileId,
      fileName,
      ownerId,
      s3Key,
      s3VersionId,
      sha256
    );
    
    // Convert Buffer to string properly
    const resultString = Buffer.from(result).toString('utf8');
    console.log('[fabricGateway] File integrity record created on blockchain:', {
      fileId,
      s3VersionId,
      transactionResult: resultString.length > 100 ? resultString.substring(0, 100) + '...' : resultString
    });
    
    let transactionId = null;
    try {
      const resultObj = JSON.parse(resultString);
      transactionId = resultObj.txId || null;
    } catch (parseError) {
      console.log('[fabricGateway] Could not parse transaction result as JSON:', parseError.message);
    }
    
    return {
      success: true,
      transactionId,
      result: resultString,
    };
    
  } catch (error) {
    console.error('[fabricGateway] Failed to submit file integrity record:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Query file integrity record from blockchain
 * 
 * @param {string} fileId - File identifier
 * @param {string} s3VersionId - S3 version identifier
 * @returns {Promise<Object>} Query result
 */
async function queryFileIntegrityRecord(fileId, s3VersionId) {
  try {
    const contract = await getContract();
    
    const result = await contract.evaluateTransaction(
      'GetFileIntegrityRecord',
      fileId,
      s3VersionId
    );
    
    // Convert Buffer to string properly
    const resultString = Buffer.from(result).toString('utf8');
    
    return {
      success: true,
      record: JSON.parse(resultString),
    };
    
  } catch (error) {
    console.error('[fabricGateway] Failed to query file integrity record:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify file integrity against blockchain record
 * 
 * @param {string} fileId - File identifier
 * @param {string} s3VersionId - S3 version identifier  
 * @param {string} sha256 - Current file SHA-256 hash
 * @returns {Promise<Object>} Verification result
 */
async function verifyFileIntegrity(fileId, s3VersionId, sha256) {
  try {
    const contract = await getContract();
    
    const result = await contract.evaluateTransaction(
      'VerifyFileIntegrity',
      fileId,
      s3VersionId,
      sha256
    );
    
    const resultString = Buffer.from(result).toString('utf8');
    
    return {
      success: true,
      verification: JSON.parse(resultString),
    };
    
  } catch (error) {
    console.error('[fabricGateway] Failed to verify file integrity:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get file version history from blockchain
 * 
 * @param {string} fileId - File identifier
 * @returns {Promise<Object>} History result
 */
async function getFileHistory(fileId) {
  try {
    const contract = await getContract();
    
    const result = await contract.evaluateTransaction(
      'GetFileHistory',
      fileId
    );
    
    const resultString = Buffer.from(result).toString('utf8');
    
    return {
      success: true,
      history: JSON.parse(resultString),
    };
    
  } catch (error) {
    console.error('[fabricGateway] Failed to get file history:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Record file recovery audit on blockchain
 * 
 * Creates an immutable record documenting a successful file recovery operation.
 * This transaction validates that the restored content matches the trusted hash.
 * 
 * @param {Object} recoveryData - Recovery audit data
 * @param {string} recoveryData.fileId - File identifier
 * @param {string} recoveryData.fileName - Original filename
 * @param {string} recoveryData.userId - User who performed recovery
 * @param {string} recoveryData.originalS3VersionId - Original trusted S3 version
 * @param {string} recoveryData.restoredS3VersionId - New current S3 version
 * @param {string} recoveryData.trustedSha256 - Blockchain-verified hash
 * @param {string} recoveryData.restoredSha256 - Hash of restored content
 * @param {string} recoveryData.recoveryReason - Reason for recovery (e.g., "integrity_mismatch")
 * @returns {Promise<Object>} Transaction result
 */
async function recordFileRecovery(recoveryData) {
  try {
    const {
      fileId,
      fileName,
      userId,
      originalS3VersionId,
      restoredS3VersionId,
      trustedSha256,
      restoredSha256,
      recoveryReason,
    } = recoveryData;
    
    // Validate required fields
    if (!fileId || !fileName || !userId || !originalS3VersionId || 
        !restoredS3VersionId || !trustedSha256 || !restoredSha256 || !recoveryReason) {
      throw new Error('Missing required fields for recovery audit record');
    }
    
    const contract = await getContract();
    
    // Submit recovery audit transaction
    const result = await contract.submitTransaction(
      'RecordFileRecovery',
      fileId,
      fileName,
      userId,
      originalS3VersionId,
      restoredS3VersionId,
      trustedSha256,
      restoredSha256,
      recoveryReason
    );
    
    const resultString = Buffer.from(result).toString('utf8');
    console.log('[fabricGateway] File recovery recorded on blockchain:', {
      fileId,
      userId,
      transactionResult: resultString.length > 100 ? resultString.substring(0, 100) + '...' : resultString
    });
    
    let transactionId = null;
    try {
      const resultObj = JSON.parse(resultString);
      transactionId = resultObj.txId || null;
    } catch (parseError) {
      console.log('[fabricGateway] Could not parse recovery transaction result as JSON:', parseError.message);
    }
    
    return {
      success: true,
      transactionId,
      result: resultString,
    };
    
  } catch (error) {
    console.error('[fabricGateway] Failed to record file recovery:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get file recovery history from blockchain
 * 
 * @param {string} fileId - File identifier
 * @returns {Promise<Object>} Recovery history result
 */
async function getFileRecoveryHistory(fileId) {
  try {
    const contract = await getContract();
    
    const result = await contract.evaluateTransaction(
      'GetFileRecoveryHistory',
      fileId
    );
    
    const resultString = Buffer.from(result).toString('utf8');
    
    return {
      success: true,
      history: JSON.parse(resultString),
    };
    
  } catch (error) {
    console.error('[fabricGateway] Failed to get file recovery history:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

function closeGateway() {
  if (gatewayInstance) {
    gatewayInstance.close();
    gatewayInstance = null;
    contractInstance = null;
    console.log('[fabricGateway] Gateway connection closed');
  }
}

// Graceful shutdown
process.on('SIGINT', closeGateway);
process.on('SIGTERM', closeGateway);

module.exports = {
  getGateway,
  getContract,
  submitFileIntegrityRecord,
  queryFileIntegrityRecord,
  verifyFileIntegrity,
  getFileHistory,
  recordFileRecovery,
  getFileRecoveryHistory,
  closeGateway,
  FABRIC_CONFIG,
};