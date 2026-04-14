const express = require('express');
const router = express.Router();
const pengajuanController = require('../controllers/pengajuanController');
const { authenticateToken } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for profile photos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../../uploads/profile');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, 'profile-' + req.user.id + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Dosen Routes
router.get('/dosen/list', authenticateToken, pengajuanController.getPengajuanByDosen);
router.put('/:id/status', authenticateToken, pengajuanController.updatePengajuanStatus);

// Common Routes
router.post('/', authenticateToken, pengajuanController.createPengajuan);
router.get('/dosen', authenticateToken, pengajuanController.getDosenList);
router.get('/profile', authenticateToken, pengajuanController.getMahasiswaProfile);
router.get('/profile/dosen', authenticateToken, pengajuanController.getDosenProfile);
router.put('/profile', authenticateToken, upload.single('photo'), pengajuanController.updateMahasiswaProfile);
router.put('/profile/dosen', authenticateToken, upload.single('photo'), pengajuanController.updateDosenProfile);
router.get('/profile/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/profile', filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ message: "Photo not found" });
    }
});
router.get('/:id', authenticateToken, pengajuanController.getPengajuanById);

module.exports = router;
