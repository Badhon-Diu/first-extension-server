'use strict';

const fs = require('fs');
const path = require('path');
const { CONFIG } = require('../config');
const { createTimeout } = require('../utils/helpers');

async function analyzeAudio(filePath, mimeType, students = []) {
  const apiUrl = CONFIG.audioApiUrl.replace(/\/+$/, '') + '/transcribe';
  console.log(`[Audio] Sending to Audio API: ${apiUrl}`);

  const { signal, clear } = createTimeout(120_000);
  try {
    const audioBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath) || '.webm';
    const filename = 'audio' + ext;

    // Use the native FormData/Blob API (Node 18+) instead of hand-building the
    // multipart body. fetch() sets the boundary + Content-Length automatically,
    // so filenames with quotes/spaces/non-ASCII chars can't corrupt the headers.
    const formData = new FormData();
    formData.append('audio', new Blob([audioBuffer], { type: mimeType || 'audio/mpeg' }), filename);

    // Optional dataset part (matches the field name the Audio API expects)
    if (students && Array.isArray(students) && students.length > 0) {
      formData.append('dataset', JSON.stringify(students));
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Audio API error ${response.status}: ${errorText}`);
    }

    return response.json();
  } finally {
    clear();
  }
}

module.exports = { analyzeAudio };
