'use strict';

const { admin, isFirebaseReady, getFirebaseError } = require('../services/firebase.service');

/**
 * requireAuth — validates the Firebase ID token from the Authorization header.
 * Adds the decoded user to req.user on success.
 */
async function requireAuth(req, res, next) {
  if (!isFirebaseReady()) {
    return res.status(503).json({
      error: 'Authentication is not configured. Server operator must set Firebase service account.',
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided. Send "Authorization: Bearer <token>"' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

/**
 * requireAdmin — must run AFTER requireAuth. Only allows the configured admin.
 * Admins are matched by ADMIN_EMAIL or ADMIN_UID env var.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && req.user.email && req.user.email.toLowerCase() === adminEmail.toLowerCase()) {
    return next();
  }

  const adminUid = process.env.ADMIN_UID;
  if (adminUid && req.user.uid === adminUid) {
    return next();
  }

  console.warn(`[Auth] Admin denied for ${req.user.email || req.user.uid}`);
  return res.status(403).json({ error: 'Forbidden: Admin access required' });
}

module.exports = { requireAuth, requireAdmin };
