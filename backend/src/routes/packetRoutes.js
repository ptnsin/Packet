const express = require('express');
const router = express.Router();
const packetController = require('../controllers/packetController');
const geoController = require('../controllers/geoController');
const { isAdmin } = require('../middlewares/authMiddleware');

// ดึงประวัติ + Advanced Search/Filter (User/Admin ดูได้หมด)
router.get('/history', packetController.getHistory);

// ดึงสถิติสรุป (Dashboard Charts)
router.get('/stats', packetController.getStats);

// ✅ Export Data — ?format=csv หรือ format=json
router.get('/export', packetController.exportData);

// ✅ PDF Report
router.get('/report', packetController.exportPDF);

// ✅ Geolocation Mapping
router.get('/geo', geoController.getGeoMap);

// Admin เท่านั้น
router.delete('/clear', isAdmin, packetController.clearHistory);

module.exports = router;