const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const asyncHandler = require('../middleware/asyncHandler');
const { addComment, addReply, getComments } = require('../controllers/commentController');

router.post('/:submission_id', asyncHandler(authenticate), requireRole('admin'), asyncHandler(addComment));
router.post('/:submission_id/:comment_id/replies', asyncHandler(authenticate), requireRole('member'), asyncHandler(addReply));
router.get('/:submission_id', asyncHandler(authenticate), asyncHandler(getComments));

module.exports = router;
