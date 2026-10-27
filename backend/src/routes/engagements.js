const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/engagementController');

router.use(asyncHandler(authenticate), requireRole('admin'));
router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.get));
router.patch('/:id', asyncHandler(controller.update));
router.post('/:id/engagements', asyncHandler(controller.createEngagement));

module.exports = router;
