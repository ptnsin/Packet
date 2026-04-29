const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAdmin } = require('../middlewares/authMiddleware');

router.get('/', isAdmin, userController.getUsers);
router.delete('/:id', isAdmin, userController.deleteUser);

module.exports = router;