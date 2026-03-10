const express = require('express');
const router = express.Router();
const pengajuanController = require('../controllers/pengajuanController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Dosen Routes
router.get('/dosen/list', authenticateToken, pengajuanController.getPengajuanByDosen);
router.put('/:id/status', authenticateToken, pengajuanController.updatePengajuanStatus);

// Common Routes
router.post('/', authenticateToken, pengajuanController.createPengajuan);
router.get('/dosen', authenticateToken, pengajuanController.getDosenList);
router.get('/profile', authenticateToken, pengajuanController.getMahasiswaProfile);
router.get('/:id', authenticateToken, pengajuanController.getPengajuanById);

module.exports = router;
