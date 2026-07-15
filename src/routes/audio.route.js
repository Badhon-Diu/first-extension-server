'use strict';

const fs   = require('fs');
const path = require('path');
const { Router } = require('express');
const { AUDIO_DIR } = require('../config');
const { audioUpload } = require('../middleware/upload');
const { analyzeAudio } = require('../services/audio.service');
const { deleteFile } = require('../utils/helpers');

const router = Router();

router.post('/', audioUpload.single('audio'), async (req, res) => {
  let tempFile, mimeType;
  let students = [];

  try {
    // ── Multipart file upload (Postman) ──
    if (req.file) {
      tempFile = req.file.path;
      mimeType = req.file.mimetype;
      if (req.body.students) {
        try { students = JSON.parse(req.body.students); } catch {}
      }
      console.log(`[Audio] Received file: ${req.file.originalname} (${req.file.size} bytes)`);
    }
    // ── Base64 JSON (browser extension) ──
    else if (req.body && req.body.audio) {
      const audioBuffer = Buffer.from(req.body.audio, 'base64');
      tempFile = path.join(AUDIO_DIR, `audio-${Date.now()}.webm`);
      mimeType = 'audio/webm';
      fs.writeFileSync(tempFile, audioBuffer);
      students = req.body.students || [];
      console.log(`[Audio] Received base64 audio (${audioBuffer.length} bytes)`);
    }
    else {
      return res.status(400).json({ error: 'No audio provided. Send file with field "audio" or JSON with "audio" (base64).' });
    }

    const data = await analyzeAudio(tempFile, mimeType, students);
    console.log('[Audio] Response:', JSON.stringify(data).slice(0, 300));
    return res.status(200).json(data);

  } catch (err) {
    console.error('[Audio] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to analyze audio', details: err.message });
    }
  } finally {
    if (tempFile) deleteFile(tempFile);
  }
});

module.exports = router;
