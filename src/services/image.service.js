'use strict';

const { CONFIG } = require('../config');
const { normalizeMark, createTimeout } = require('../utils/helpers');

/**
 * Send image(s) to your Image API and get back structured results.
 * The API returns [{ "student id": "...", mark: N }, ...] directly.
 *
 * @param {Array<{ buffer: Buffer, mimetype: string, originalname: string }>} files
 * @param {Array<{id: string, name: string}>} [students]
 * @returns {Promise<Array<{ "student id": string, mark: number }>>}
 */
async function analyzeAllImages(files, students = []) {
  const apiUrl = CONFIG.imageApiUrl;
  console.log(`[Image] Sending ${files.length} image(s) to: ${apiUrl}`);

  const formData = new FormData();
  for (const file of files) {
    formData.append('images', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  }
  if (students.length > 0) {
    formData.append('students', JSON.stringify(students));
  }

  const { signal, clear } = createTimeout(120_000);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Image API error ${response.status}: ${text}`);
    }

    return response.json();
  } finally {
    clear();
  }
}

/**
 * Analyze a single image (for backward compatibility with session route).
 * Returns the JSON array as a string, matching the old signature.
 *
 * @param {{ buffer: Buffer, mimetype: string, originalname: string }} file
 * @param {Array<{id: string, name: string}>} [students]
 * @returns {Promise<string>}
 */
async function analyzeImage(file, students = []) {
  const results = await analyzeAllImages([file], students);
  return JSON.stringify(results);
}

/**
 * Parse the JSON string from analyzeImage into structured records.
 *
 * @param {string} rawText
 * @returns {Array<{ "student id": string, mark: number }>}
 */
function parseImageOutput(rawText) {
  const parsed = JSON.parse(rawText);
  if (!Array.isArray(parsed)) throw new Error('Image API did not return an array');
  return parsed.map(item => ({
    'student id': item['student id'] || item.id || item.studentId || item.student_id || 'N/A',
    mark: normalizeMark(item.mark),
  }));
}

module.exports = { analyzeImage, parseImageOutput, analyzeAllImages };
