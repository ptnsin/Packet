const express = require('express');
const router = express.Router();
const packetController = require('../controllers/packetController');

// เส้นทางสำหรับดึงประวัติ
router.get('/history', packetController.getHistory);

module.exports = router;