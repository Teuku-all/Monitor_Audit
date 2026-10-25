const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const upload = require('../middleware/upload');
const {
  getAllSubmissions,
  getMySubmissions,
  getSubmissionById,
  createSubmission,
  updateStatus,
  getStats,
} = require('../controllers/submissionController');

// Admin
router.get('/', authenticate, requireRole('admin'), getAllSubmissions);
router.get('/stats', authenticate, requireRole('admin'), getStats);
router.patch('/:id/status', authenticate, requireRole('admin'), updateStatus);

// Member
router.get('/mine', authenticate, requireRole('member'), getMySubmissions);
router.post('/', authenticate, requireRole('member'), upload.single('file'), createSubmission);

// Both roles
router.get('/:id', authenticate, getSubmissionById);

module.exports = router;
