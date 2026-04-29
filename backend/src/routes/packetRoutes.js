const express = require('express');
const router = express.Router();
const packetController = require('../controllers/packetController');
const { isAdmin } = require('../middlewares/authMiddleware');

// ดึงประวัติ (User/Admin ดูได้หมด)
router.get('/history', packetController.getHistory);

// ดึงสถิติสรุป (Dashboard Charts)
router.get('/stats', packetController.getStats);

// ตัวอย่างฟังก์ชันที่ Admin เท่านั้นที่ทำได้
router.delete('/clear', isAdmin, packetController.clearHistory);

module.exports = router;