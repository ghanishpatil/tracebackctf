const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const submissionController = require('../controllers/submissionController');

const router = Router();

router.post('/submit-flag', authenticate, submissionController.submitFlag);

module.exports = router;
