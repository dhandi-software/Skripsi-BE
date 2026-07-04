const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');
const jadwalKpController = require('../controllers/jadwalKpController');

// All users can see the active schedule
router.get('/active', authenticateToken, jadwalKpController.getActiveJadwalKp);
// All users can see all schedules
router.get('/', authenticateToken, jadwalKpController.getAllJadwalKp);

// Only Staf can manage schedules
router.post('/', authenticateToken, authorizeRole(['staf', 'admin']), jadwalKpController.createJadwalKp);
router.put('/:id', authenticateToken, authorizeRole(['staf', 'admin']), jadwalKpController.updateJadwalKp);
router.delete('/:id', authenticateToken, authorizeRole(['staf', 'admin']), jadwalKpController.deleteJadwalKp);

module.exports = router;
