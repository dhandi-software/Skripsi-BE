const express = require('express');
const router = express.Router();
const { createMahasiswa, createDosen } = require('../controllers/adminController');

// In a real app, you should add authentication and authorization middleware here
// e.g. router.use(verifyToken, verifyAdminRole);

router.post('/create-mahasiswa', createMahasiswa);
router.post('/create-mahasiswa-massal', require('../controllers/adminController').createMahasiswaMassal);
router.post('/create-dosen-massal', require('../controllers/adminController').createDosenMassal);
router.post('/create-dosen', createDosen);
router.get('/users/count', require('../controllers/adminController').getUserCountByRole);
router.get('/users-role', require('../controllers/adminController').getUsersByRole);
router.get('/monitoring', require('../controllers/adminController').getMonitoringData);
router.put('/users/:id', require('../controllers/adminController').updateUser);
router.post('/users/batch-delete', require('../controllers/adminController').deleteUsersBatch);
router.post('/users/mahasiswa/clear-all', require('../controllers/adminController').deleteAllMahasiswa);
router.post('/users/dosen/clear-all', require('../controllers/adminController').deleteAllDosen);
router.delete('/users/:id', require('../controllers/adminController').deleteUser);
router.get('/users/:id', require('../controllers/adminController').getUserById);
router.get('/dashboard-stats', require('../controllers/adminController').getDashboardStats);

module.exports = router;
