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

    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const parts = [];

    // Audio file part
    let header = `--${boundary}\r\n`;
    header += `Content-Disposition: form-data; name="audio"; filename="audio${ext}"\r\n`;
    header += `Content-Type: ${mimeType || 'audio/mpeg'}\r\n\r\n`;
    parts.push(Buffer.from(header, 'utf-8'));
    parts.push(audioBuffer);
    parts.push(Buffer.from('\r\n', 'utf-8'));

    // Optional dataset part
    if (students && Array.isArray(students) && students.length > 0) {
      let dsHeader = `--${boundary}\r\n`;
      dsHeader += `Content-Disposition: form-data; name="dataset"\r\n\r\n`;
      dsHeader += JSON.stringify(students);
      dsHeader += '\r\n';
      parts.push(Buffer.from(dsHeader, 'utf-8'));
    }

    // Closing boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));

    const bodyBuffer = Buffer.concat(parts);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(bodyBuffer.length),
      },
      body: bodyBuffer,
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
