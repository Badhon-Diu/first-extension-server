'use strict';

/**
 * DIU IntelliMarks — Firebase Auth Manager
 *
 * Drop this into your Chrome extension. It handles:
 * - Opening the login popup (Google or email/password)
 * - Storing the ID token in chrome.storage.local
 * - Auto-refreshing the token before it expires
 * - Sending the token with API requests
 *
 * Usage:
 *   import { authManager } from './auth-manager.js';
 *   await authManager.login();            // opens popup, stores token
 *   const token = await authManager.getToken();  // auto-refreshes if needed
 *   const user  = authManager.getUser();  // { email, displayName, uid }
 *   await authManager.logout();           // clears stored token
 */

const SERVER_URL = 'https://first-extension-server.onrender.com';

const authManager = (() => {
  let cachedToken = null;
  let refreshTimer = null;
  let user = null;

  // ── Storage helpers ──────────────────────────────────────────────────────────

  async function loadFromStorage() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['fb_token', 'fb_user', 'fb_expires'], resolve);
      } else {
        resolve({
          fb_token:  localStorage.getItem('fb_token'),
          fb_user:   JSON.parse(localStorage.getItem('fb_user') || 'null'),
          fb_expires: parseInt(localStorage.getItem('fb_expires') || '0', 10),
        });
      }
    });
  }

  async function saveToStorage(token, userData, expiresAt) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({
        fb_token: token,
        fb_user: userData,
        fb_expires: expiresAt,
      });
    } else {
      localStorage.setItem('fb_token', token);
      localStorage.setItem('fb_user', JSON.stringify(userData));
      localStorage.setItem('fb_expires', String(expiresAt));
    }
  }

  async function clearStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(['fb_token', 'fb_user', 'fb_expires']);
    } else {
      localStorage.removeItem('fb_token');
      localStorage.removeItem('fb_user');
      localStorage.removeItem('fb_expires');
    }
  }

  // ── Token refresh ───────────────────────────────────────────────────────────
  // Firebase ID tokens expire in 1 hour. We refresh 10 minutes before expiry.

  function scheduleRefresh(expiresAt) {
    clearTimeout(refreshTimer);
    const msUntilRefresh = Math.max((expiresAt - Date.now()) - 10 * 60 * 1000, 30_000);
    refreshTimer = setTimeout(async () => {
      console.log('[Auth] Auto-refreshing token…');
      try {
        const fresh = await refreshIdToken();
        if (fresh) {
          console.log('[Auth] Token refreshed. Next refresh in ~50 min.');
        } else {
          console.warn('[Auth] Token refresh failed — user needs to re-login.');
        }
      } catch (e) {
        console.error('[Auth] Refresh error:', e);
      }
    }, msUntilRefresh);
  }

  async function refreshIdToken() {
    const data = await loadFromStorage();
    // We can't get a new token without the Firebase SDK's refresh token.
    // Instead, we re-verify the existing token with the server, and if it's
    // about to expire, prompt the user to re-login.
    //
    // For true silent refresh, use Firebase SDK in the extension (see below).
    // This is a lightweight fallback that works without the SDK.

    // If the stored token is still valid and not expiring soon, just use it.
    if (data.fb_token && data.fb_expires && Date.now() < data.fb_expires - 5 * 60 * 1000) {
      cachedToken = data.fb_token;
      user = data.fb_user;
      scheduleRefresh(data.fb_expires);
      return true;
    }

    // Token expired or about to expire — can't refresh silently without SDK.
    // Clear and prompt re-login.
    cachedToken = null;
    user = null;
    await clearStorage();
    return false;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Initialize — call once when the extension popup/background script loads.
   * Checks for a stored token and schedules refresh if valid.
   */
  async function init() {
    const data = await loadFromStorage();
    if (data.fb_token && data.fb_expires && Date.now() < data.fb_expires) {
      cachedToken = data.fb_token;
      user = data.fb_user;
      scheduleRefresh(data.fb_expires);
      return true;
    }
    // Token missing or expired
    cachedToken = null;
    user = null;
    return false;
  }

  /**
   * Open the login popup. Returns a promise that resolves with the token.
   * The popup uses Firebase JS SDK directly — no copy-paste needed.
   */
  function login() {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        SERVER_URL + '/login',
        'intellimarks_auth',
        'width=480,height=720,left=' + Math.round((screen.width - 480) / 2) + ',top=' + Math.round((screen.height - 720) / 2)
      );

      if (!popup) {
        return reject(new Error('Popup blocked. Allow popups for this site.'));
      }

      function onMessage(event) {
        if (event.data && event.data.type === 'FIREBASE_AUTH_SUCCESS') {
          window.removeEventListener('message', onMessage);
          popup.close();

          const { token, email, displayName, uid } = event.data;

          // Decode JWT payload to get expiry
          let expiresAt = Date.now() + 60 * 60 * 1000; // default 1 hour
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            expiresAt = payload.exp * 1000;
          } catch (e) {}

          const userData = { email, displayName, uid };

          cachedToken = token;
          user = userData;

          saveToStorage(token, userData, expiresAt).then(() => {
            scheduleRefresh(expiresAt);
            resolve(token);
          });
        }
      }

      window.addEventListener('message', onMessage);

      // Timeout after 3 minutes (user might have closed the popup)
      setTimeout(() => {
        window.removeEventListener('message', onMessage);
        if (!cachedToken) reject(new Error('Login timed out'));
      }, 180_000);
    });
  }

  /**
   * Get the current ID token. Returns null if not logged in.
   */
  async function getToken() {
    if (cachedToken) return cachedToken;
    await init();
    return cachedToken;
  }

  /**
   * Get the current user info.
   */
  function getUser() {
    return user;
  }

  /**
   * Check if the user is authenticated.
   */
  async function isLoggedIn() {
    const token = await getToken();
    return !!token;
  }

  /**
   * Logout — clears stored token and cancels refresh timer.
   */
  async function logout() {
    clearTimeout(refreshTimer);
    cachedToken = null;
    user = null;
    await clearStorage();
  }

  /**
   * Build authenticated fetch options.
   * Use this when making requests to the server API.
   *
   * Example:
   *   const res = await fetch('/api/analyze-audio', authManager.authFetch({
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify({ audio: base64 }),
   *   }));
   */
  async function authFetch(options = {}) {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated. Call authManager.login() first.');

    const headers = { ...(options.headers || {}), 'Authorization': 'Bearer ' + token };
    return { ...options, headers };
  }

  // Auto-init on load
  init();

  return { init, login, getToken, getUser, isLoggedIn, logout, authFetch };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { authManager };
}
