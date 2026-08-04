'use strict';

const { Router } = require('express');
const { admin, isFirebaseReady, getFirebaseError } = require('../services/firebase.service');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Public web config — safe to expose (it's the browser config)
const FIREBASE_WEB_CONFIG = {
  apiKey:            process.env.FIREBASE_API_KEY            || 'AIzaSyCuCWjZts5wDvSZhYpy42k9sICNBoaRN7U',
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || 'diu-intellimarks.firebaseapp.com',
  projectId:         process.env.FIREBASE_PROJECT_ID         || 'diu-intellimarks',
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || 'diu-intellimarks.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '522586039529',
  appId:             process.env.FIREBASE_APP_ID             || '1:522586039529:web:63045268966d6dddf13c78',
  measurementId:     process.env.FIREBASE_MEASUREMENT_ID     || 'G-7205KXJNC9',
};

// GET /login — render the signup/login page
router.get('/login', (_req, res) => {
  res.render('login', { firebaseConfig: JSON.stringify(FIREBASE_WEB_CONFIG) });
});

// GET /api/auth/me — verify the extension's token and return the user
router.get('/me', requireAuth, (req, res) => {
  res.json({
    uid:   req.user.uid,
    email: req.user.email || null,
    name:  req.user.name || null,
    picture: req.user.picture || null,
    iat:   req.user.iat,
    exp:   req.user.exp,
  });
});

// GET /api/auth/verify — lightweight check that a token is valid
router.post('/verify', async (req, res) => {
  if (!isFirebaseReady()) {
    return res.status(503).json({ error: 'Authentication not configured. ' + (getFirebaseError() || '') });
  }
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: 'Missing token in body' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    res.json({ valid: true, uid: decoded.uid, email: decoded.email || null });
  } catch (err) {
    res.status(401).json({ valid: false, error: err.message });
  }
});

// POST /api/auth/revoke — revoke all refresh tokens for the current user (sign out everywhere)
router.post('/revoke', requireAuth, async (req, res) => {
  try {
    await admin.auth().revokeRefreshTokens(req.user.uid);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/config — expose public web config to the extension if needed
router.get('/config', (_req, res) => {
  res.json(FIREBASE_WEB_CONFIG);
});

module.exports = router;
