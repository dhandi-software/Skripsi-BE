const express = require('express');
const router = express.Router();
const { createMahasiswa, createDosen } = require('../controllers/adminController');

// In a real app, you should add authentication and authorization middleware here
// e.g. router.use(verifyToken, verifyAdminRole);

router.post('/create-mahasiswa', createMahasiswa);
router.post('/create-dosen', createDosen);
router.get('/users/count', require('../controllers/adminController').getUserCountByRole);
router.get('/users-role', require('../controllers/adminController').getUsersByRole);
router.get('/monitoring', require('../controllers/adminController').getMonitoringData);
router.put('/users/:id', require('../controllers/adminController').updateUser);
router.delete('/users/:id', require('../controllers/adminController').deleteUser);
router.get('/users/:id', require('../controllers/adminController').getUserById);

module.exports = router;
