'use strict';

const fs   = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let firebaseApp = null;
let initError   = null;

function initFirebase() {
  if (firebaseApp || admin.apps.length > 0) {
    firebaseApp = admin.apps[0];
    return firebaseApp;
  }

  try {
    let serviceAccount = null;

    // 1. Base64-encoded service-account JSON (recommended for Render)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
      serviceAccount = JSON.parse(json);
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
        'Firebase service account not found. Set FIREBASE_SERVICE_ACCOUNT (base64 JSON) ' +
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
