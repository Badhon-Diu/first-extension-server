'use strict';

const { Router } = require('express');
const { imageUpload } = require('../middleware/upload');
const { analyzeAllImages } = require('../services/image.service');

const router = Router();

/**
 * POST /api/analyze-images
 *
 * Accepts up to 10 images as multipart/form-data (field name: "images").
 * Forwards all images to your Image API which handles LLM extraction.
 *
 * Response:
 *   200  [{ "student id": "XXX-XX-XXX", mark: 15 }, ...]
 *   400  { error: "No images provided" }
 */
router.post('/', imageUpload.array('images', 10), async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  let students = [];
  if (req.body.students) {
    try { students = JSON.parse(req.body.students); } catch { /* ignore bad JSON */ }
  }
  if (students.length > 0) {
    console.log(`[Image] Student context: ${students.length} student(s)`);
  }

  console.log(`[Image] Received ${files.length} image(s). Sending all to Image API...`);

  try {
    const results = await analyzeAllImages(files, students);
    console.log(`[Image] Done. ${results.length} record(s) extracted.`);
    return res.json(results);
  } catch (err) {
    console.error('[Image] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
