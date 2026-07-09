'use strict';

const express = require('express');
const { requireRole } = require('../utils/auth');

const controlCenterReadService = require('../services/controlCenterReadService');

const router = express.Router();

router.get('/overview', requireRole('admin'), (_req, res) => {
  res.json(controlCenterReadService.overview());
});

router.get('/projects', requireRole('admin'), (_req, res) => {
  res.json(controlCenterReadService.projectList());
});

router.get('/assets', requireRole('admin'), (req, res) => {
  const {
    q,
    state,
    group,
    owner,
    page,
    pageSize,
  } = req.query || {};

  res.json(
    controlCenterReadService.assetList({
      q,
      state,
      group,
      owner,
      page,
      pageSize,
    })
  );
});

router.get('/gates', requireRole('admin'), (_req, res) => {
  res.json(controlCenterReadService.gates());
});

router.get('/runtime', requireRole('admin'), (_req, res) => {
  res.json(controlCenterReadService.runtime());
});

router.get('/findings', requireRole('admin'), (_req, res) => {
  res.json(controlCenterReadService.findings());
});

module.exports = router;

