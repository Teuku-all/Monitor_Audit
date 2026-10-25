const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { addComment, addReply, getComments } = require('../controllers/commentController');

router.post('/:submission_id', authenticate, requireRole('admin'), addComment);
router.post('/:submission_id/:comment_id/replies', authenticate, requireRole('member'), addReply);
router.get('/:submission_id', authenticate, getComments);

module.exports = router;
