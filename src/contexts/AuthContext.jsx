import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  clearAuthCookies,
  clearLegacyAuthStorage,
  hasAuthCookies,
  isAuthSessionExpired,
  touchAuthSessionStart,
  persistSsoSession,
  clearSsoSession,
  hasSsoSession,
  getSsoEmail,
  touchSsoSessionStart,
  isSsoSessionExpired,
} from '../utils/authCookies';
import { verifyUrlIdToken } from '../utils/firebase';

const AuthContext = createContext();
const SESSION_TIMEOUT = 30 * 60 * 1000;        // 30-min idle timeout
const ABSOLUTE_SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8-hour absolute timeout

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => (hasAuthCookies() && !isAuthSessionExpired(SESSION_TIMEOUT)) ||
          (hasSsoSession() && !isSsoSessionExpired(SESSION_TIMEOUT))
  );
  const [userId, setUserId] = useState(
    () => localStorage.getItem('advisorUserId') || getSsoEmail() || ''
  );
  const [googleConnected, setGoogleConnectedState] = useState(
    () => {
      const val = localStorage.getItem('googleCalConnected') === 'true';
      console.log('[AuthContext] initial googleConnected:', val);
      return val;
    }
  );
  // ready=false only when ?idToken is present — prevents render before SSO is processed.
  // Normal sessions start with ready=true to avoid any flash.
  const [ready, setReady] = useState(
    () => !new URLSearchParams(window.location.search).get('idToken')
  );
  const [ssoLoggedOut, setSsoLoggedOut] = useState(false);
  const timerRef = useRef(null);

  const absoluteTimerRef = useRef(null);

  const logout = useCallback((email) => {
    clearTimeout(timerRef.current);
    clearTimeout(absoluteTimerRef.current);
    const wasSso = hasSsoSession();
    clearAuthCookies();
    clearSsoSession();
    clearLegacyAuthStorage();
    localStorage.removeItem('googleCalConnected');
    setIsAuthenticated(false);
    setUserId('');
    setGoogleConnectedState(false);
    if (wasSso) {
      setSsoLoggedOut(true);
      try { window.parent.postMessage({ type: 'wa_sso_logout' }, '*'); } catch { /* ignore */ }
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => logout(userId), SESSION_TIMEOUT);
  }, [isAuthenticated, logout, userId]);

  const absoluteEmailRef = useRef('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlIdToken = params.get('idToken');
    const urlEmail = params.get('email');
    console.log('[SSO] AuthContext mount — idToken present:', !!urlIdToken, 'email:', urlEmail);

    if (urlIdToken && urlEmail) {
      const { valid } = verifyUrlIdToken(urlIdToken);
      window.history.replaceState({}, '', window.location.pathname);
      if (valid) {
        console.log('[SSO] token valid — persisting session for', urlEmail);
        persistSsoSession(urlIdToken, urlEmail);
        clearLegacyAuthStorage();
        localStorage.setItem('advisorUserId', urlEmail);
        setUserId(urlEmail);
        setIsAuthenticated(true);
      } else {
        console.log('[SSO] token invalid — redirecting to sessionExpired');
        window.location.replace('/login?sessionExpired=1');
        return;
      }
    }
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = (email) => {
    touchAuthSessionStart();
    clearLegacyAuthStorage();
    if (email) {
      localStorage.setItem('advisorUserId', email);
      setUserId(email);
      absoluteEmailRef.current = email;
    }
    setIsAuthenticated(true);
  };

  const setGoogleConnected = (val) => {
    if (val) {
      localStorage.setItem('googleCalConnected', 'true');
    } else {
      localStorage.removeItem('googleCalConnected');
    }
    setGoogleConnectedState(val);
  };

  useEffect(() => {
    if (!ready) return; // wait until SSO processing is complete
    clearLegacyAuthStorage();
    const cookieOk = hasAuthCookies() && !isAuthSessionExpired(SESSION_TIMEOUT);
    const ssoOk = hasSsoSession() && !isSsoSessionExpired(SESSION_TIMEOUT);
    if (!cookieOk && !ssoOk) { setIsAuthenticated(false); return; }
    if (!isAuthenticated) return;

    resetTimer();
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => {
      if (hasAuthCookies()) touchAuthSessionStart();
      if (hasSsoSession()) touchSsoSessionStart();
      resetTimer();
    };
    events.forEach((e) => window.addEventListener(e, handleActivity));

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(absoluteTimerRef.current);
      events.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, [isAuthenticated, resetTimer, logout]);

  // Absolute session timer — separate effect so it never restarts on activity
  useEffect(() => {
    if (!isAuthenticated) return;
    clearTimeout(absoluteTimerRef.current);
    absoluteTimerRef.current = setTimeout(() => logout(absoluteEmailRef.current || userId), ABSOLUTE_SESSION_TIMEOUT);
    return () => clearTimeout(absoluteTimerRef.current);
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const [cockpitReady, setCockpitReady] = useState(false);

  if (!ready) return null;

  return (
    <AuthContext.Provider value={{
      isAuthenticated, userId, googleConnected, ssoLoggedOut, ready,
      login, logout: () => logout(userId), setGoogleConnected,
      cockpitReady, setCockpitReady,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
