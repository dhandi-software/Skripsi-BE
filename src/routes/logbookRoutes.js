const express = require('express');
const router = express.Router();
const logbookController = require('../controllers/logbookController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Logbook Info (Header Perusahaan)
router.get('/info', logbookController.getLogbookInfo);
router.post('/info', logbookController.updateLogbookInfo);

// Logbook Entries
router.get('/entries', logbookController.getLogbooks);
router.post('/entries/sync', logbookController.syncLogbooks);
router.get('/student-profile/:id', logbookController.getStudentProfile);

// Routes for Dosen/Supervisor later (e.g. approve/paraf)
// router.put('/entries/:id/paraf', requireRole(['DOSEN']), logbookController.parafLogbook);

module.exports = router;
