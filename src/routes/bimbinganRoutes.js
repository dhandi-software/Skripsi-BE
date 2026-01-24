const express = require('express');
const router = express.Router();
const bimbinganController = require('../controllers/bimbinganController');

router.get('/', bimbinganController.getAllBimbingan);
router.post('/', bimbinganController.createBimbingan);
router.get('/mahasiswa/:mahasiswaId', bimbinganController.getBimbinganByMahasiswa);

module.exports = router;
