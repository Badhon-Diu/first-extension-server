'use strict';

const fs   = require('fs');
const path = require('path');
const { Router } = require('express');
const { AUDIO_DIR } = require('../config');
const { analyzeAudio } = require('../services/audio.service');
const { deleteFile } = require('../utils/helpers');

const router = Router();

router.post('/', async (req, res) => {
  const { audio: base64Audio, assessment, students } = req.body;
  if (!base64Audio) return res.status(400).json({ error: 'No audio data provided' });

  console.log(`[Audio] Received base64 audio for assessment: ${assessment}`);

  const audioBuffer = Buffer.from(base64Audio, 'base64');
  const tempFile    = path.join(AUDIO_DIR, `audio-${Date.now()}.webm`);
  fs.writeFileSync(tempFile, audioBuffer);
  console.log(`[Audio] Saved temp file: ${tempFile} (${audioBuffer.length} bytes)`);

  try {
    const data = await analyzeAudio(tempFile, 'audio/webm', students || []);
    console.log('[Audio] Response from Audio API:', JSON.stringify(data).slice(0, 300));
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Audio] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to analyze audio', details: err.message });
    }
  } finally {
    deleteFile(tempFile);
  }
});

module.exports = router;
