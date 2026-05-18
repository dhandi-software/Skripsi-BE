const express = require('express');
const router = express.Router();
const { 
    getDownloads, 
    createDownload, 
    updateDownload, 
    deleteDownload, 
    uploadFile,
    getDownloadById,
    downloadFile
} = require('../controllers/downloadController');
const { authenticateToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.use(authenticateToken);

router.get('/', getDownloads);
router.get('/:id', getDownloadById);
router.get('/:id/download', downloadFile);
router.post('/', createDownload);
router.post('/upload', upload.single('file'), uploadFile);
router.put('/:id', updateDownload);
router.delete('/:id', deleteDownload);

module.exports = router;
