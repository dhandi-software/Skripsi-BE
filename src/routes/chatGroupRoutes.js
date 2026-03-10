const express = require('express');
const router = express.Router();
const chatGroupController = require('../controllers/chatGroupController');

// All endpoints fall under /api/chat/groups
router.post('/', chatGroupController.createGroup);

module.exports = router;
