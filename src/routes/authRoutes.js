const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.put('/change-password', authenticateToken, authController.changePassword);
router.post('/check-email', authController.checkEmail);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
