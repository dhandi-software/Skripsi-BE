const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const upload = require('../middleware/upload');

router.use('/groups', require('./chatGroupRoutes'));

router.post('/upload', upload.single('file'), chatController.uploadAttachment);
router.get('/history/:userId/:otherUserId', chatController.getChatHistory);
router.get('/contacts/:userId', chatController.getContacts);
router.get('/unread/:userId', chatController.getUnreadCount);

module.exports = router;
