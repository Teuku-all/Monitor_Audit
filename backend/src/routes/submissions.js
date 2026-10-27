const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const asyncHandler = require('../middleware/asyncHandler');
const upload = require('../middleware/upload');
const { validateUploadedFile } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/security');
const {
  getAllSubmissions,
  getMySubmissions,
  getSubmissionById,
  downloadSubmission,
  createSubmission,
  updateStatus,
  getStats,
} = require('../controllers/submissionController');

// Admin
router.get('/', asyncHandler(authenticate), requireRole('admin'), asyncHandler(getAllSubmissions));
router.get('/stats', asyncHandler(authenticate), requireRole('admin'), asyncHandler(getStats));
router.patch('/:id/status', asyncHandler(authenticate), requireRole('admin'), asyncHandler(updateStatus));

// Member
router.get('/mine', asyncHandler(authenticate), requireRole('member'), asyncHandler(getMySubmissions));
router.post('/', uploadLimiter, asyncHandler(authenticate), requireRole('member'), upload.single('file'), validateUploadedFile, asyncHandler(createSubmission));

// Both roles
router.get('/:id/file', asyncHandler(authenticate), asyncHandler(downloadSubmission));
router.get('/:id', asyncHandler(authenticate), asyncHandler(getSubmissionById));

module.exports = router;
