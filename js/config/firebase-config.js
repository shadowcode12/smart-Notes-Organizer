// Firebase Auth + Firestore. Cloud Storage is intentionally unused on the Spark plan.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const firebaseConfig = window.SMART_NOTES_FIREBASE_CONFIG || {
  apiKey: 'AIzaSyBE9f1kFy2Mgp6p7HGrVPSs5_mUkyLvOGk',
  authDomain: 'smartnotes-8f51d.firebaseapp.com',
  projectId: 'smartnotes-8f51d',
  messagingSenderId: '631078618718',
  appId: '1:631078618718:web:e6a94f4d97e71682edd6cf'
};

const placeholderPattern = /YOUR_|REPLACE|PLACEHOLDER|example|changeme/i;
export function isInvalidApiKeyError(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  return text.includes('invalid-api-key') || text.includes('api-key-not-valid') || text.includes('api key not valid');
}

// These errors are common when testing a static site from file:// or an unregistered host.
// Treat them like an invalid key so the app can continue with its local session mode.
export function isLocalFallbackError(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const transientNetworkFailure = text.includes('unavailable')
    || text.includes('network-request-failed')
    || text.includes('failed to fetch')
    || text.includes('offline');
  return isInvalidApiKeyError(error) || offline || transientNetworkFailure;
}

export const useLocalMode = placeholderPattern.test(firebaseConfig.apiKey || '') || (firebaseConfig.apiKey || '').length < 20;
export let auth = null;
export let db = null;

if (!useLocalMode) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.warn('Firebase initialization failed. SmartNotes is using local mode.', error);
  }
}

export const firebaseReady = Boolean(auth && db);

export const isLiveFirebase = firebaseReady && !useLocalMode;

export function resolvePagePath(targetPage) {
  const inPagesDir = window.location.pathname.includes('/pages/');
  if (targetPage === 'index.html') return inPagesDir ? '../index.html' : 'index.html';
  const cleanPage = targetPage.replace(/^pages\//, '');
  return inPagesDir ? cleanPage : `pages/${cleanPage}`;
}

export const workspacePages = ['dashboard.html', 'notes.html', 'chats.html'];

export default { firebaseConfig, auth, db, firebaseReady, useLocalMode, isInvalidApiKeyError, isLocalFallbackError, resolvePagePath };
