'use strict';

/**
 * Example: Extension popup that uses auth-manager.js
 *
 * This shows how to add Login/Logout buttons and use authenticated API calls
 * in your extension popup. Copy the relevant parts into your existing popup.
 */

// ── Import the auth manager ───────────────────────────────────────────────────
// In popup.html add: <script src="auth-manager.js"></script>

document.addEventListener('DOMContentLoaded', async () => {
  const loginBtn   = document.getElementById('loginBtn');
  const logoutBtn  = document.getElementById('logoutBtn');
  const statusEl   = document.getElementById('authStatus');
  const testBtn    = document.getElementById('testApiBtn');
  const resultEl   = document.getElementById('result');

  // ── Check login status on load ─────────────────────────────────────────────
  const loggedIn = await authManager.isLoggedIn();
  updateUI(loggedIn);

  // ── Login button ───────────────────────────────────────────────────────────
  loginBtn.addEventListener('click', async () => {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Opening login…';
    try {
      await authManager.login();
      updateUI(true);
    } catch (err) {
      statusEl.textContent = 'Login failed: ' + err.message;
      statusEl.style.color = '#ef4444';
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign in with Google';
    }
  });

  // ── Logout button ──────────────────────────────────────────────────────────
  logoutBtn.addEventListener('click', async () => {
    await authManager.logout();
    updateUI(false);
  });

  // ── Test API call ──────────────────────────────────────────────────────────
  testBtn.addEventListener('click', async () => {
    try {
      const token = await authManager.getToken();
      if (!token) return showResult('Not logged in', true);

      const res = await fetch('https://first-extension-server.onrender.com/api/analyze-audio', await authManager.authFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: 'test_base64_data', students: [] }),
      }));

      const data = await res.json();
      showResult(JSON.stringify(data, null, 2), !res.ok);
    } catch (err) {
      showResult('Error: ' + err.message, true);
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  function updateUI(loggedIn) {
    if (loggedIn) {
      const user = authManager.getUser();
      statusEl.textContent = 'Signed in as ' + (user?.email || 'Unknown');
      statusEl.style.color = '#22c55e';
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'block';
      testBtn.style.display = 'block';
    } else {
      statusEl.textContent = 'Not signed in';
      statusEl.style.color = '#6b7280';
      loginBtn.style.display = 'block';
      logoutBtn.style.display = 'none';
      testBtn.style.display = 'none';
      resultEl.style.display = 'none';
    }
  }

  function showResult(text, isError) {
    resultEl.textContent = text;
    resultEl.style.display = 'block';
    resultEl.style.background = isError ? '#fef2f2' : '#f0fdf4';
    resultEl.style.color = isError ? '#dc2626' : '#15803d';
    resultEl.style.border = '1px solid ' + (isError ? '#fecaca' : '#bbf7d0');
  }
});
