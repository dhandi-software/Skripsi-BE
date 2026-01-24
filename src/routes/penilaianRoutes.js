const express = require('express');
const router = express.Router();
const penilaianController = require('../controllers/penilaianController');

router.get('/', penilaianController.getAllPenilaian);
router.post('/', penilaianController.createPenilaian);
router.get('/mahasiswa/:mahasiswaId', penilaianController.getPenilaianByMahasiswa);

module.exports = router;
