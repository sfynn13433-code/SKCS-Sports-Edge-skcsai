'use strict';

const express = require('express');
const { requireRole } = require('../utils/auth');
const { requireSupabaseUser } = require('../middleware/supabaseJwt');
const { generateBotResponse } = require('../controllers/edgeMindController');

const router = express.Router();

router.post('/', requireRole('user'), requireSupabaseUser, generateBotResponse);
router.post('/chat', requireRole('user'), requireSupabaseUser, generateBotResponse);

module.exports = router;
