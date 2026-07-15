'use strict';

const fs = require('fs');

/**
 * Safely delete a file — won't throw if already gone.
 * @param {string} filePath
 */
function deleteFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Returns an AbortSignal that fires after `ms` milliseconds,
 * plus a `clear()` to cancel the timer if the request finishes first.
 * @param {number} ms
 * @returns {{ signal: AbortSignal, clear: () => void }}
 */
function createTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

/**
 * Coerce any mark value to a non-negative integer.
 * Returns 0 for null / undefined / NaN.
 * @param {*} value
 * @returns {number}
 */
function normalizeMark(value) {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (value === null || value === undefined) return 0;
  const parsed = parseInt(String(value), 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Strip <think>…</think> reasoning blocks emitted by models like
 * DeepSeek-V4-Flash and Gemma before JSON.parse() is called.
 * @param {string} text
 * @returns {string}
 */
function stripThinkingBlock(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Fuzzy-match a key (ID fragment, name, or partial ID) against a dataset of
 * { id, name } records. Returns the best match or null.
 *
 * Matching priority:
 *   1. Exact match on id
 *   2. Exact match on name (case-insensitive)
 *   3. id starts-with or ends-with the key (or vice versa)
 *   4. name includes the key (case-insensitive) or vice versa
 *
 * @param {string} key          The raw key extracted by the LLM
 * @param {Array<{id:string, name:string}>} dataset
 * @returns {{ id: string, score: number } | null}
 */
function matchToDataset(key, dataset) {
  if (!key || !Array.isArray(dataset) || dataset.length === 0) return null;

  const k = String(key).trim();

  // 1. Exact match on id
  let match = dataset.find(d => String(d.id).trim() === k);
  if (match) return { id: match.id, score: 1.0 };

  // 2. Exact match on name (case-insensitive)
  const kl = k.toLowerCase();
  match = dataset.find(d => String(d.name || '').toLowerCase() === kl);
  if (match) return { id: match.id, score: 0.95 };

  // 3. Partial/substring match on id
  for (const d of dataset) {
    const id = String(d.id).trim();
    if (id.includes(k) || k.includes(id)) {
      return { id: d.id, score: 0.8 };
    }
  }

  // 4. Partial/substring match on name
  const nameMatches = dataset.filter(d => {
    const n = String(d.name || '').toLowerCase();
    return n.includes(kl) || kl.includes(n);
  });
  if (nameMatches.length === 1) {
    return { id: nameMatches[0].id, score: 0.7 };
  }

  // 5. Numeric suffix match (e.g. key "241" matches id ending in "241")
  if (/^\d{1,6}$/.test(k)) {
    for (const d of dataset) {
      const id = String(d.id).trim();
      if (id.endsWith(k)) {
        return { id: d.id, score: 0.75 };
      }
    }
  }

  return null;
}

module.exports = { deleteFile, createTimeout, normalizeMark, stripThinkingBlock, matchToDataset };
