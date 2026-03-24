const express = require('express');
const router = express.Router();
const bimbinganController = require('../controllers/bimbinganController');
const { authenticateToken } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../../uploads/bimbingan');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === 'application/msword' || 
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.mimetype === 'application/pdf'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only .pdf, .doc, and .docx files are allowed!'), false);
        }
    }
});

router.get('/', authenticateToken, bimbinganController.getAllBimbingan);
router.post('/', authenticateToken, bimbinganController.createBimbingan);
router.get('/mahasiswa/:mahasiswaId', authenticateToken, bimbinganController.getBimbinganByMahasiswa);

// New Routes
router.get('/dosen-students', authenticateToken, bimbinganController.getDosenBimbinganStudents);
router.post('/assign-task', authenticateToken, bimbinganController.assignBimbinganTask);
router.put('/edit-task/:id', authenticateToken, bimbinganController.updateBimbinganTask);
router.get('/mahasiswa-active-task', authenticateToken, bimbinganController.getMahasiswaActiveTask);
router.get('/mahasiswa-all-tasks', authenticateToken, bimbinganController.getMahasiswaAllTasks);
router.put('/mark-as-read/:id', authenticateToken, bimbinganController.markAsRead);

// Upload routes
router.post('/upload-mahasiswa/:id', authenticateToken, upload.single('file'), bimbinganController.uploadDraftMahasiswa);
router.post('/upload-dosen/:id', authenticateToken, upload.single('file'), bimbinganController.uploadRevisiDosen);

// Additional Routes for Versioning & Annotations
router.get('/history/:mahasiswaId/:topik', authenticateToken, bimbinganController.getBimbinganHistory);
router.post('/annotations', authenticateToken, bimbinganController.createAnnotation);
router.get('/annotations/:bimbinganId', authenticateToken, bimbinganController.getAnnotations);
router.delete('/annotations/:id', authenticateToken, bimbinganController.deleteAnnotation);

module.exports = router;
