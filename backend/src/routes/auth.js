const express = require('express');
const router = express.Router();
const { register, login, logout, googleLogin, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { authLimiter } = require('../middleware/security');

router.post('/register', authLimiter, asyncHandler(register));
router.post('/login', authLimiter, asyncHandler(login));
router.post('/google', authLimiter, asyncHandler(googleLogin));
router.post('/logout', asyncHandler(authenticate), asyncHandler(logout));
router.get('/profile', asyncHandler(authenticate), asyncHandler(getProfile));

module.exports = router;
