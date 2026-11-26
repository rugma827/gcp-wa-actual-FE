import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ThemeController from './controllers/ThemeController';
import App from './App.jsx';
import { getFirebaseToken, getSessionId, isAccessTokenExpired, updateAuthTokens, clearAuthCookies, clearLegacyAuthStorage } from './utils/authCookies';
import { refreshFirebaseToken } from './utils/firebase';

let _sessionInvalidating = false;
function handleSessionInvalidated() {
  if (_sessionInvalidating) return;
  // For SSO sessions, clear the expired token and redirect to login
  const ssoToken = localStorage.getItem('wa_sso_access_token');
  if (ssoToken) {
    try {
      const payload = JSON.parse(atob(ssoToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      // Token still valid — don't invalidate (likely a Google Calendar 401, not auth)
      if (payload.exp > Math.floor(Date.now() / 1000)) return;
    } catch { /* malformed — fall through and clear */ }
    ['wa_sso_access_token', 'wa_sso_session_start', 'wa_sso_email'].forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('googleCalConnected');
    window.location.replace('/login?sessionExpired=1');
    return;
  }
  _sessionInvalidating = true;
  clearAuthCookies();
  clearLegacyAuthStorage();
  localStorage.removeItem('googleCalConnected');
  window.location.replace('/login?sessionExpired=1');
}

// Patch global fetch to inject auth headers and handle session invalidation
const _originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const isBackend = url.includes('localhost:8000') || url.includes('wealth-advisory') || url.includes('.run.app');
  if (isBackend) {
    // For SSO sessions with a valid token, skip Firebase SDK refresh (no currentUser)
    const ssoToken = localStorage.getItem('wa_sso_access_token');
    let isSsoValid = false;
    if (ssoToken) {
      try {
        const p = JSON.parse(atob(ssoToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        isSsoValid = p.exp > Math.floor(Date.now() / 1000);
      } catch { /* malformed */ }
    }
    if (!isSsoValid && isAccessTokenExpired()) {
      const refreshed = await refreshFirebaseToken();
        if (refreshed) {
          updateAuthTokens(refreshed);
        } else {
          handleSessionInvalidated();
          return new Response(JSON.stringify({ detail: 'Session invalidated' }), { status: 401 });
        }
    }
    const headers = new Headers(init.headers || {});
    const token = getFirebaseToken();
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    const sessionId = getSessionId();
    if (sessionId && !headers.has('X-Session-ID')) headers.set('X-Session-ID', sessionId);
    init = { ...init, headers };
  }
  const response = await _originalFetch(input, init);
  if (isBackend && response.status === 401) {
    try {
      const clone = response.clone();
      const body = await clone.json();
      console.warn('[Auth] 401 body:', JSON.stringify(body), 'url:', url);
      if (body?.detail === 'Session invalidated') {
        handleSessionInvalidated();
      }
    } catch { /* non-JSON 401, ignore */ }
  }
  return response;
};

// Apply theme before first render so CSS variables are available immediately
ThemeController.applyTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
