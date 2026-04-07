const express = require('express');
const router = express.Router();
const chatGroupController = require('../controllers/chatGroupController');

// All endpoints fall under /api/chat/groups
router.post('/', chatGroupController.createGroup);
router.delete('/:id', chatGroupController.deleteGroup);
router.post('/:id/members', chatGroupController.addMembers);
router.delete('/:id/members/:userId', chatGroupController.removeMember);

module.exports = router;
