'use strict';

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { CONFIG } = require('../config');
const { createTimeout } = require('../utils/helpers');

async function analyzeAudio(filePath, mimeType, students = []) {
  const apiUrl = CONFIG.audioApiUrl.replace(/\/+$/, '') + '/transcribe';
  console.log(`[Audio] Sending to Audio API: ${apiUrl}`);

  const { signal, clear } = createTimeout(120_000);
  try {
    const ext = path.extname(filePath) || '.webm';

    const form = new FormData();
    form.append('audio', fs.createReadStream(filePath), {
      filename: `audio${ext}`,
      contentType: mimeType || 'audio/mpeg',
    });

    if (students && Array.isArray(students) && students.length > 0) {
      form.append('dataset', JSON.stringify(students));
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: form.getHeaders(),
      body: form,
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
