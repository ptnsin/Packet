const express = require('express')
const router = express.Router()
const { getGeoMap } = require('../controllers/geoController')

router.get('/map', getGeoMap)

module.exports = router