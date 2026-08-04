'use strict';

const fs   = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let firebaseApp = null;
let initError   = null;

/**
 * Parse the FIREBASE_SERVICE_ACCOUNT env value.
 * Accepts EITHER the raw service-account JSON (simplest to paste into Render)
 * OR the JSON base64-encoded. Falls back to a clear error otherwise.
 */
function parseServiceAccount(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    // Not raw JSON — try base64-decoding it before parsing again
    try {
      return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
    } catch (__) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is neither valid JSON nor valid base64-encoded JSON');
    }
  }
}

function initFirebase() {
  if (firebaseApp || admin.apps.length > 0) {
    firebaseApp = admin.apps[0];
    return firebaseApp;
  }

  try {
    let serviceAccount = null;

    // 1. FIREBASE_SERVICE_ACCOUNT env var — raw JSON OR base64 JSON (recommended for Render)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    // 2. Path to a JSON file via GOOGLE_APPLICATION_CREDENTIALS
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const raw = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
      serviceAccount = JSON.parse(raw);
    }
    // 3. firebase-service-account.json sitting in the project root
    else {
      const localPath = path.join(__dirname, '../../firebase-service-account.json');
      if (fs.existsSync(localPath)) {
        const raw = fs.readFileSync(localPath, 'utf8');
        serviceAccount = JSON.parse(raw);
      }
    }

    if (!serviceAccount) {
      throw new Error(
        'Firebase service account not found. Set FIREBASE_SERVICE_ACCOUNT (raw JSON or base64 JSON) ' +
        'in your env, or add firebase-service-account.json to the project root.'
      );
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase] Admin SDK initialized (project: ' + (serviceAccount.project_id || 'unknown') + ')');
  } catch (err) {
    initError = err.message;
    console.error('[Firebase] Init failed: ' + err.message);
  }

  return firebaseApp;
}

initFirebase();

module.exports = {
  admin,
  firebaseApp,          // null if not configured
  isFirebaseReady: () => !!firebaseApp,
  getFirebaseError: () => initError,
};
