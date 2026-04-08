const express = require('express');
const router = express.Router();
const { 
    getAcara, 
    createAcara, 
    updateAcara, 
    deleteAcara, 
    addComment,
    uploadFile,
    getUnreadCount,
    markAsRead
} = require('../controllers/acaraController');
const { authenticateToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.use(authenticateToken);

router.get('/', getAcara);
router.get('/unread-count', getUnreadCount);
router.post('/', createAcara);
router.post('/upload', upload.single('file'), uploadFile);
router.put('/:id', updateAcara);
router.delete('/:id', deleteAcara);
router.post('/:id/read', markAsRead);
router.post('/:id/comment', addComment);

module.exports = router;
