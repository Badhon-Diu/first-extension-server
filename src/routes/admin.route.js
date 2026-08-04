'use strict';

const { Router } = require('express');
const { admin, isFirebaseReady, getFirebaseError } = require('../services/firebase.service');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = Router();

const MAX_USERS = 1000; // Firebase listUsers page size limit

function mapUser(u) {
  const providerId = u.providerData && u.providerData[0]
    ? u.providerData[0].providerId
    : 'unknown';

  let provider;
  if (providerId === 'google.com') provider = 'Google';
  else if (providerId === 'password') provider = 'Email / Password';
  else if (providerId === 'phone') provider = 'Phone';
  else provider = providerId || 'Unknown';

  return {
    uid: u.uid,
    email: u.email || '(no email)',
    displayName: u.displayName || '(no name)',
    photoURL: u.photoURL || null,
    provider,
    createdAt: u.metadata.creationTime,
    lastLogin: u.metadata.lastSignInTime,
    disabled: !!u.disabled,
  };
}

// ── HTML admin dashboard ────────────────────────────────────────────────────
// GET /admin
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  if (!isFirebaseReady()) {
    return res.status(500).send('Firebase not configured: ' + (getFirebaseError() || ''));
  }

  try {
    const list = await admin.auth().listUsers(MAX_USERS);
    const users = list.users.map(mapUser);
    res.render('admin', {
      users,
      count: users.length,
      admin: { email: req.user.email || null, name: req.user.name || null },
    });
  } catch (err) {
    console.error('[Admin] List failed:', err.message);
    res.status(500).send('Failed to load users: ' + err.message);
  }
});

// ── JSON API ────────────────────────────────────────────────────────────────
// GET /api/admin/users
router.get('/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const list = await admin.auth().listUsers(MAX_USERS);
    res.json({ count: list.users.length, users: list.users.map(mapUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:uid
router.delete('/users/:uid', requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  if (!uid || !/^[a-zA-Z0-9_-]{4,128}$/.test(uid)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    await admin.auth().deleteUser(uid);
    console.log(`[Admin] Deleted user ${uid} by ${req.user.email || req.user.uid}`);
    res.json({ success: true, uid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
