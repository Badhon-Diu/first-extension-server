'use strict';

const { admin, isFirebaseReady, getFirebaseError } = require('../services/firebase.service');

const COOKIE_NAME = 'fb_token';

// Tiny cookie parser (avoids a dependency for a single cookie)
function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

// Browser page visits get redirected to /login; API calls get a JSON 401
function wantsHtml(req) {
  return req.method === 'GET' && !req.originalUrl.startsWith('/api/');
}

/**
 * requireAuth — validates the Firebase ID token from the Authorization header,
 * or from the fb_token cookie (used by the browser-based admin dashboard).
 * Adds the decoded user to req.user on success.
 */
async function requireAuth(req, res, next) {
  if (!isFirebaseReady()) {
    const detail = getFirebaseError();
    const msg = 'Authentication is not configured' +
      (detail ? ' (' + detail + ')' : '. Server operator must set Firebase service account.');
    if (wantsHtml(req)) return res.redirect('/login');
    return res.status(503).json({ error: msg });
  }

  const authHeader = req.headers.authorization || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) token = readCookie(req, COOKIE_NAME);

  if (!token) {
    if (wantsHtml(req)) {
      return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl || '/'));
    }
    return res.status(401).json({ error: 'Unauthorized: No token provided. Send "Authorization: Bearer <token>"' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);
    if (wantsHtml(req)) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl || '/'));
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

// Clears the browser session cookie
function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
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

module.exports = { requireAuth, requireAdmin, clearSessionCookie, COOKIE_NAME };
