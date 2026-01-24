const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const upload = require('../middleware/upload');

router.post('/upload', upload.single('file'), chatController.uploadAttachment);
router.get('/history/:userId/:otherUserId', chatController.getChatHistory);
router.get('/contacts/:userId', chatController.getContacts);

module.exports = router;
