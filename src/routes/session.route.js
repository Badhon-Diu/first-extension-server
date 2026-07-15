'use strict';

const fs   = require('fs');
const path = require('path');
const { Router } = require('express');
const { SESSIONS_DIR } = require('../config');
const { analyzeAllImages } = require('../services/image.service');

const router = Router();

const IMAGE_EXTS = /\.(jpe?g|png|webp|gif)$/i;

const MIME = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

function listSessionFiles(uuid) {
  const dir = path.join(SESSIONS_DIR, uuid);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => IMAGE_EXTS.test(f))
    .map(f => path.join(dir, f));
}

// GET /api/session/:uuid
router.get('/:uuid', (req, res) => {
  const { uuid } = req.params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uuid)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const files = listSessionFiles(uuid);
  res.json({
    uuid,
    count: files.length,
    files: files.map(f => path.basename(f)),
  });
});

// POST /api/session/:uuid/analyze
router.post('/:uuid/analyze', async (req, res) => {
  const { uuid } = req.params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uuid)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const filePaths = listSessionFiles(uuid);
  if (filePaths.length === 0) {
    return res.status(400).json({ error: 'No images found for this session.' });
  }

  const students = Array.isArray(req.body.students) ? req.body.students : [];
  console.log(`[Session] ${uuid}: ${filePaths.length} image(s), ${students.length} student(s)`);

  const files = filePaths.map(fp => {
    const buffer = fs.readFileSync(fp);
    const ext = path.extname(fp).toLowerCase();
    return { buffer, mimetype: MIME[ext] || 'image/jpeg', originalname: path.basename(fp) };
  });

  try {
    const results = await analyzeAllImages(files, students);
    console.log(`[Session] ${uuid}: done. ${results.length} record(s)`);
    return res.json(results);
  } catch (err) {
    console.error(`[Session] ${uuid}: error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
