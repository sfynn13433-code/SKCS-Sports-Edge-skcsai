'use strict';

const express = require('express');
const { requireRole } = require('../utils/auth');
const { generateBotResponse } = require('../controllers/edgeMindController');

const router = express.Router();

router.post('/', requireRole('user'), generateBotResponse);
router.post('/chat', requireRole('user'), generateBotResponse);

module.exports = router;
