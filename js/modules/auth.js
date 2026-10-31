import { auth, db, firebaseReady, authPersistenceReady, isLocalFallbackError, resolvePagePath } from '../config/firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const api = window.SmartNotes ||= {};
const SESSION_KEY = 'smartnotes-local-session';
const FIREBASE_USER_CACHE_KEY = 'smartnotes-firebase-user';
const USERS_KEY = 'smartnotes-local-users';
let localMode = !firebaseReady;
const listeners = new Set();
let authReadyPromise = null;
const sanitizeText = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);

const message = (text, error = true) => {
  const element = document.querySelector('[data-auth-message]') || document.querySelector('.form-message');
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('error', error);
  element.classList.toggle('success', !error);
};
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
const localUsers = () => readJson(USERS_KEY, []);
const saveUsers = users => localStorage.setItem(USERS_KEY, JSON.stringify(users));
const localSession = () => readJson(SESSION_KEY, null);
const cachedFirebaseUser = () => readJson(FIREBASE_USER_CACHE_KEY, null);
const saveSession = user => localStorage.setItem(SESSION_KEY, JSON.stringify(user));
const saveFirebaseUser = user => user ? localStorage.setItem(FIREBASE_USER_CACHE_KEY, JSON.stringify(userFromRecord(user))) : null;
const clearSession = () => localStorage.removeItem(SESSION_KEY);
const clearFirebaseUser = () => localStorage.removeItem(FIREBASE_USER_CACHE_KEY);
const notify = () => listeners.forEach(listener => listener(currentUser()));
const userFromRecord = record => ({ uid: record.uid, email: record.email, displayName: record.displayName, provider: record.provider || 'local' });
function enableLocalMode(error) { if (localMode) return; localMode = true; console.warn('Firebase API key is unavailable. SmartNotes switched to local mode.', error); notify(); }

export const currentUser = () => localMode ? localSession() : auth?.currentUser || cachedFirebaseUser() || null;
export function waitForAuthReady() {
  if (!auth) return Promise.resolve(localSession());
  if (!authReadyPromise) {
    authReadyPromise = authPersistenceReady.then(async () => {
      if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
        return auth.currentUser || null;
      }
      if (auth.currentUser) return auth.currentUser;
      return new Promise(resolve => {
        let settled = false;
        let unsubscribe;
        const finish = user => {
          if (settled) return;
          settled = true;
          unsubscribe?.();
          if (user) saveFirebaseUser(user);
          resolve(user || null);
        };
        unsubscribe = onAuthStateChanged(auth, user => {
          if (user) return finish(user);
          if (!cachedFirebaseUser()) return finish(null);
          setTimeout(() => finish(auth.currentUser || null), 250);
        });
      });
    });
  }
  return authReadyPromise;
}
export async function signUp(email, password, displayName = '') {
  const normalizedPassword = String(password || '');
  const hasUpper = /[A-Z]/.test(normalizedPassword);
  const hasLower = /[a-z]/.test(normalizedPassword);
  const hasNumberOrSymbol = /[^A-Za-z0-9]/.test(normalizedPassword) || /\d/.test(normalizedPassword);
  if (normalizedPassword.length < 10 || !hasUpper || !hasLower || !hasNumberOrSymbol) {
    throw new Error('Password must be at least 10 characters and contain at least one uppercase letter, one lowercase letter, and one number or symbol.');
  }
  if (localMode) {
    const users = localUsers();
    if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) throw new Error('An account with this email already exists.');
    const user = { uid: crypto.randomUUID(), email, password, displayName: sanitizeText(displayName), provider: 'local', createdAt: Date.now() };
    saveUsers([...users, user]); saveSession(userFromRecord(user)); notify(); return currentUser();
  }
  try {
    await authPersistenceReady;
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const safeName = sanitizeText(displayName);
    if (safeName) await updateProfile(result.user, { displayName: safeName });
    await setDoc(doc(db, 'users', result.user.uid), { displayName: safeName, email, updatedAt: serverTimestamp() }, { merge: true });
    try {
      await sendEmailVerification(result.user);
    } catch (verErr) {
      console.warn('Could not send verification email:', verErr);
    }
    return result.user;
  } catch (error) { if (!isLocalFallbackError(error)) throw error; enableLocalMode(error); return signUp(email, password, displayName); }
}
const syncProfile = async user => {
  if (!user || localMode || !db) return user;
  await setDoc(doc(db, 'users', user.uid), {
    displayName: sanitizeText(user.displayName || ''),
    email: user.email || '',
    updatedAt: serverTimestamp()
  }, { merge: true });
  return user;
};

export async function logIn(email, password) {
  if (localMode) {
    const user = localUsers().find(item => item.email.toLowerCase() === email.toLowerCase() && item.password === password);
    if (!user) throw new Error('Email or password is incorrect.');
    saveSession(userFromRecord(user)); notify(); return currentUser();
  }
  try { await authPersistenceReady; return await syncProfile((await signInWithEmailAndPassword(auth, email, password)).user); }
  catch (error) { if (!isLocalFallbackError(error)) throw error; enableLocalMode(error); return logIn(email, password); }
}
export async function signInWithGoogle() {
  if (localMode) { const user = { uid: 'local-google-user', email: 'student@gmail.com', displayName: 'Google Student', provider: 'google' }; saveSession(user); notify(); return user; }
  try {
    await authPersistenceReady;
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await syncProfile(result.user);
    return result.user;
  } catch (error) { if (!isLocalFallbackError(error)) throw error; enableLocalMode(error); return signInWithGoogle(); }
}
export async function logOut() {
  if (localMode) { clearSession(); clearFirebaseUser(); notify(); return; }
  try { await signOut(auth); clearFirebaseUser(); }
  catch (error) { if (!isLocalFallbackError(error)) throw error; enableLocalMode(error); clearSession(); clearFirebaseUser(); notify(); }
}
export function onUserChange(callback) {
  listeners.add(callback);
  if (localMode) { callback(currentUser()); return () => listeners.delete(callback); }
  return onAuthStateChanged(auth, user => {
    if (user) saveFirebaseUser(user);
    if (user) syncProfile(user).catch(error => console.warn('Could not sync user profile.', error));
    callback(user);
  }, error => {
    if (isLocalFallbackError(error)) { enableLocalMode(error); callback(currentUser()); }
  });
}
export async function requireAuth(redirect = 'login.html') {
  const user = await waitForAuthReady();
  if (!user && redirect) location.href = resolvePagePath(redirect);
  return user || null;
}
export async function requireGuest(redirect = 'index.html') {
  const user = await waitForAuthReady();
  if (user && redirect) location.href = resolvePagePath(redirect);
  return !user;
}
export function initAuthGuard() {
  let active = true;
  waitForAuthReady().then(user => {
    if (!active) return;
    const page = window.location.pathname.split('/').pop().toLowerCase();
    const protectedPage = ['dashboard.html', 'notes.html', 'chats.html'].includes(page);
    const authPage = ['login.html', 'signup.html'].includes(page);
    if (protectedPage && !user) window.location.replace(resolvePagePath('login.html'));
    if (authPage && user) window.location.replace(resolvePagePath('notes.html'));
  });
  return () => { active = false; };
}
export async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail) throw new Error('Enter your email address first.');
  if (localMode) {
    message('Local demo mode is active: password reset emails require live Firebase Authentication and cannot be sent for local-only browser accounts.', true);
    return;
  }
  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
    message('Password reset email sent! Check your inbox.', false);
  } catch (error) {
    if (isLocalFallbackError(error)) {
      enableLocalMode(error);
      message('Local demo mode is active: password reset emails require live Firebase Authentication and cannot be sent for local-only browser accounts.', true);
      return;
    }
    throw error;
  }
}
export async function resendVerificationEmail() {
  const user = auth?.currentUser;
  if (!user) throw new Error('No signed-in user found.');
  if (localMode) {
    message('Local demo mode is active: email verification is only available with live Firebase Authentication.', true);
    return;
  }
  await sendEmailVerification(user);
  message('Verification email resent! Check your inbox.', false);
}
export function bindAuthForms() {
  const form = document.querySelector('.auth-card form'); if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const email = form.querySelector('#email')?.value.trim(); const password = form.querySelector('#password')?.value || ''; const name = sanitizeText(form.querySelector('#name')?.value || '');
    if (location.pathname.endsWith('signup.html')) {
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumberOrSymbol = /[^A-Za-z0-9]/.test(password) || /\d/.test(password);
      if (!email || !name || password.length < 10 || !hasUpper || !hasLower || !hasNumberOrSymbol) {
        message('Please complete all fields. Passwords must be at least 10 characters with uppercase, lowercase, and a number or symbol.');
        return;
      }
    } else if (!email || !password) {
      message('Please enter your email and password.');
      return;
    }
    try {
      message(localMode ? 'Using local mode…' : 'Working…', false);
      if (location.pathname.endsWith('signup.html')) {
        await signUp(email, password, name);
        message('Account created! We sent a verification link to your email.', false);
      } else {
        await logIn(email, password);
      }
      setTimeout(() => { location.href = resolvePagePath('dashboard.html'); }, 1200);
    }
    catch (error) { message(error.code ? error.code.replace('auth/', '').replaceAll('-', ' ') : error.message); }
  });
  document.querySelector('[data-google-signin]')?.addEventListener('click', async () => { try { message(localMode ? 'Continuing locally…' : 'Opening Google sign-in…', false); await signInWithGoogle(); location.href = resolvePagePath('dashboard.html'); } catch (error) { message(error.code ? error.code.replace('auth/', '').replaceAll('-', ' ') : error.message || 'Google sign-in failed.'); } });
  document.querySelector('[data-forgot-password]')?.addEventListener('click', event => {
    event.preventDefault();
    const modal = document.querySelector('#password-reset-modal');
    const emailInput = document.querySelector('#password-reset-email');
    if (!modal) return;
    emailInput.value = document.querySelector('#email')?.value.trim() || '';
    modal.hidden = false;
    emailInput.focus();
  });
  document.querySelector('[data-close-password-reset]')?.addEventListener('click', () => { document.querySelector('#password-reset-modal').hidden = true; });
  document.querySelector('#password-reset-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.querySelector('#password-reset-email').value;
    try { await requestPasswordReset(email); form.reset(); document.querySelector('#password-reset-modal').hidden = true; }
    catch (error) { message(error.code ? error.code.replace('auth/', '').replaceAll('-', ' ') : error.message || 'Unable to send password reset email.'); }
  });
}
export function bindNavbar() {
  onUserChange(user => {
    document.querySelectorAll('[data-user-display]').forEach(element => { element.textContent = user?.displayName || user?.email || 'Student'; });
    document.querySelectorAll('.buttons').forEach(nav => {
    if (!user) return;
    nav.replaceChildren();
    const name = document.createElement('span');
    name.className = 'auth-user';
    name.textContent = user.displayName || user.email || 'Student';
    const logout = document.createElement('button');
    logout.className = 'button login';
    logout.type = 'button';
    logout.textContent = 'Log out';
    logout.addEventListener('click', logOut);
    nav.append(name, logout);
    });
  });
}
api.auth = { currentUser, waitForAuthReady, signUp, logIn, signInWithGoogle, logOut, onUserChange, requireAuth, requireGuest, initAuthGuard, requestPasswordReset, resendVerificationEmail, isLocalMode: () => localMode };
initAuthGuard();
bindAuthForms(); bindNavbar();
