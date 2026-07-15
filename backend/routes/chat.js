'use strict';

const express = require('express');
const { requireSupabaseUser } = require('../middleware/supabaseJwt');
const { generateBotResponse } = require('../controllers/edgeMindController');

const router = express.Router();

router.post('/', requireSupabaseUser, generateBotResponse);
router.post('/chat', requireSupabaseUser, generateBotResponse);

module.exports = router;
