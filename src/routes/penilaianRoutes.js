const express = require('express');
const router = express.Router();
const penilaianController = require('../controllers/penilaianController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, penilaianController.getAllPenilaian);
router.get('/dosen', authenticateToken, penilaianController.getPenilaianByDosen);
router.post('/', authenticateToken, penilaianController.createPenilaian);
router.put('/:id', authenticateToken, penilaianController.updatePenilaian);
router.delete('/:id', authenticateToken, penilaianController.deletePenilaian);
router.get('/mahasiswa/:mahasiswaId', authenticateToken, penilaianController.getPenilaianByMahasiswa);
router.post('/assign-penguji', authenticateToken, penilaianController.assignPenguji);
router.post('/assign-pembimbing', authenticateToken, penilaianController.assignPembimbing);

module.exports = router;
