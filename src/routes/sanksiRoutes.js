const express = require('express');
const router = express.Router();
const sanksiController = require('../controllers/sanksiController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, sanksiController.getAllSanksi);
router.get('/students', authenticateToken, sanksiController.getSupervisedStudents);
router.post('/', authenticateToken, sanksiController.createSanksi);
router.put('/:id', authenticateToken, sanksiController.updateSanksi);
router.delete('/:id', authenticateToken, sanksiController.deleteSanksi);

module.exports = router;
