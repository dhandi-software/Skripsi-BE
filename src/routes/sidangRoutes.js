const express = require('express');
const router = express.Router();
const { 
    applyForSidang, 
    approveByPembimbing, 
    scheduleByProdi, 
    getSidangDosen, 
    prodiApprove, 
    deleteSidang,
    verifyByKaprodi,
    confirmScheduleByKaprodi
} = require('../controllers/sidangController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/apply', applyForSidang);
router.put('/approve/:id', approveByPembimbing);
router.put('/approve-prodi/:id', prodiApprove);
router.put('/schedule/:id', scheduleByProdi);
router.put('/verify-kaprodi/:id', verifyByKaprodi);
router.put('/confirm-jadwal-kaprodi/:id', confirmScheduleByKaprodi);
router.get('/dosen', getSidangDosen);
router.delete('/:id', deleteSidang);

module.exports = router;
