/**
 * routes/fileRoutes.js
 * ----------------------
 * POST   /api/files/upload                    — upload file to S3
 * GET    /api/files                           — list authenticated user's files
 * GET    /api/files/preview/:key              — get inline preview pre-signed URL
 * GET    /api/files/content/:key              — stream file content directly
 * GET    /api/files/download/:key             — get pre-signed download URL
 * DELETE /api/files/:key                      — delete file from S3
 * POST   /api/files/verify/:key               — verify file integrity against blockchain
 * GET    /api/files/history/:key              — get blockchain version history
 * POST   /api/files/:key/recover              — recover original blockchain-verified file
 * GET    /api/files/recovery-history          — get user's recovery history
 * GET    /api/files/admin/blockchain          — get all blockchain-protected files (admin)
 * GET    /api/files/admin/integrity-failures  — get all integrity failures (admin)
 * GET    /api/files/admin/recovery-history    — get all recovery logs (admin)
 */

const router = require('express').Router();
const multer = require('multer');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const {
  uploadFile,
  getFiles,
  previewFile,
  getFileContent,
  downloadFile,
  deleteFile,
  verifyFileIntegrityEndpoint,
  getFileHistoryEndpoint,
  getAdminBlockchainFiles,
  getIntegrityFailures,
  recoverFile,
  getRecoveryHistory,
  deleteRecoveryRecord,
  getAdminRecoveryHistory,
} = require('../controllers/fileController');

// Store files in memory so we can pass the buffer directly to the S3 SDK
const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,   // 50 MB max
  },
  fileFilter: (_req, file, cb) => {
    // Block executable and script files for security
    const blocked = ['.exe', '.sh', '.bat', '.cmd', '.ps1'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) {
      return cb(new Error(`File type "${ext}" is not allowed.`));
    }
    cb(null, true);
  },
});

// All file routes require authentication
router.use(protect);

// Admin-only routes
router.get('/admin/blockchain', requireAdmin, getAdminBlockchainFiles);
router.get('/admin/integrity-failures', requireAdmin, getIntegrityFailures);
router.get('/admin/recovery-history', requireAdmin, getAdminRecoveryHistory);

router.post('/upload',          upload.single('file'), uploadFile);
router.get('/',                 getFiles);
router.get('/preview/:key',     previewFile);
router.get('/content/:key',     getFileContent);
router.get('/download/:key',    downloadFile);
router.delete('/:key',          deleteFile);

// Integrity verification endpoints
router.post('/verify/:key',     verifyFileIntegrityEndpoint);
router.get('/history/:key',     getFileHistoryEndpoint);

// File recovery endpoints
router.post('/:key/recover',       recoverFile);
router.get('/recovery-history',    getRecoveryHistory);
router.delete('/recovery/:recordId', deleteRecoveryRecord);

module.exports = router;

