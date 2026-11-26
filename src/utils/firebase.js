import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Sign in and return { idToken, accessToken, refreshToken }
 * idToken is the Firebase ID token — sent as Bearer to the GCP backend.
 * accessToken mirrors idToken so authCookies.getFirebaseToken() still works.
 */
export async function signInWithFirebase(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await cred.user.getIdToken();
  return {
    accessToken: idToken,   // stored in access_token cookie → getFirebaseToken()
    idToken,
    refreshToken: cred.user.refreshToken,
  };
}

export async function signUpWithFirebase(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function sendFirebasePasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function signOutFirebase() {
  await signOut(auth);
}

/** Refresh the Firebase ID token using the current user. Returns new idToken or null. */
export async function refreshFirebaseToken() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const idToken = await user.getIdToken(/* forceRefresh */ true);
    return { accessToken: idToken, idToken };
  } catch {
    return null;
  }
}

export function verifyUrlIdToken(idToken) {
  const log = (msg, data) => {
    const entry = `[SSO] ${msg} ${data ? JSON.stringify(data) : ''}`;
    console.log(entry);
    try { sessionStorage.setItem('sso_debug_' + Date.now(), entry); } catch {}
  };
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);
    log('verifyUrlIdToken', { aud: payload.aud, exp: payload.exp, now, email: payload.email, expectedAud: import.meta.env.VITE_FIREBASE_PROJECT_ID });
    if (payload.aud !== import.meta.env.VITE_FIREBASE_PROJECT_ID) {
      log('FAIL aud mismatch', { got: payload.aud, expected: import.meta.env.VITE_FIREBASE_PROJECT_ID });
      return { valid: false };
    }
    if (payload.exp <= now) {
      log('FAIL token expired', { exp: payload.exp, now });
      return { valid: false };
    }
    log('token valid OK');
    return { valid: true, email: payload.email || '' };
  } catch (e) {
    const entry = '[SSO] verifyUrlIdToken EXCEPTION: ' + e.message;
    console.error(entry);
    try { sessionStorage.setItem('sso_debug_' + Date.now(), entry); } catch {}
    return { valid: false };
  }
}

export { auth };
