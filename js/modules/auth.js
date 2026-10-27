import { auth, db, firebaseReady, isLocalFallbackError, resolvePagePath } from '../config/firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const api = window.SmartNotes ||= {};
const SESSION_KEY = 'smartnotes-local-session';
const USERS_KEY = 'smartnotes-local-users';
let localMode = !firebaseReady;
const listeners = new Set();
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
const saveSession = user => localStorage.setItem(SESSION_KEY, JSON.stringify(user));
const clearSession = () => localStorage.removeItem(SESSION_KEY);
const notify = () => listeners.forEach(listener => listener(currentUser()));
const userFromRecord = record => ({ uid: record.uid, email: record.email, displayName: record.displayName, provider: record.provider || 'local' });
function enableLocalMode(error) { if (localMode) return; localMode = true; console.warn('Firebase API key is unavailable. SmartNotes switched to local mode.', error); notify(); }

export const currentUser = () => localMode ? localSession() : auth?.currentUser || null;
export async function signUp(email, password, displayName = '') {
  if (localMode) {
    const users = localUsers();
    if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) throw new Error('An account with this email already exists.');
    const user = { uid: crypto.randomUUID(), email, password, displayName: sanitizeText(displayName), provider: 'local', createdAt: Date.now() };
    saveUsers([...users, user]); saveSession(userFromRecord(user)); notify(); return currentUser();
  }
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const safeName = sanitizeText(displayName);
    if (safeName) await updateProfile(result.user, { displayName: safeName });
    await setDoc(doc(db, 'users', result.user.uid), { displayName: safeName, email, updatedAt: serverTimestamp() }, { merge: true });
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
  try { return await syncProfile((await signInWithEmailAndPassword(auth, email, password)).user); }
  catch (error) { if (!isLocalFallbackError(error)) throw error; enableLocalMode(error); return logIn(email, password); }
}
export async function signInWithGoogle() {
  if (localMode) { const user = { uid: 'local-google-user', email: 'student@gmail.com', displayName: 'Google Student', provider: 'google' }; saveSession(user); notify(); return user; }
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await syncProfile(result.user);
    return result.user;
  } catch (error) { if (!isLocalFallbackError(error)) throw error; enableLocalMode(error); return signInWithGoogle(); }
}
export async function logOut() { if (localMode) { clearSession(); notify(); return; } try { await signOut(auth); } catch (error) { if (!isLocalFallbackError(error)) throw error; enableLocalMode(error); clearSession(); notify(); } }
export function onUserChange(callback) {
  listeners.add(callback);
  if (localMode) { callback(currentUser()); return () => listeners.delete(callback); }
  return onAuthStateChanged(auth, user => {
    if (user) syncProfile(user).catch(error => console.warn('Could not sync user profile.', error));
    callback(user);
  }, error => {
    if (isLocalFallbackError(error)) { enableLocalMode(error); callback(currentUser()); }
  });
}
export function requireAuth(redirect = 'login.html') { return new Promise(resolve => onUserChange(user => { if (!user && redirect) location.href = resolvePagePath(redirect); resolve(user || null); })); }
export function requireGuest(redirect = 'index.html') { return new Promise(resolve => onUserChange(user => { if (user && redirect) location.href = resolvePagePath(redirect); else resolve(!user); })); }
export function initAuthGuard() {
  const protectedPage = ['dashboard.html', 'notes.html', 'chats.html'].some(page => window.location.pathname.endsWith(`/${page}`) || window.location.pathname.endsWith(page));
  if (!protectedPage) return () => { };
  return onUserChange(user => {
    if (!user) window.location.replace(resolvePagePath('login.html'));
  });
}
export async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail) throw new Error('Enter your email address first.');
  if (localMode) {
    message('Password reset email sent! Check your inbox.', false);
    return;
  }
  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
    message('Password reset email sent! Check your inbox.', false);
  } catch (error) {
    if (isLocalFallbackError(error)) { enableLocalMode(error); message('Password reset email sent! Check your inbox.', false); return; }
    throw error;
  }
}
export function bindAuthForms() {
  const form = document.querySelector('.auth-card form'); if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const email = form.querySelector('#email')?.value.trim(); const password = form.querySelector('#password')?.value || ''; const name = sanitizeText(form.querySelector('#name')?.value || '');
    if (!email || password.length < 6 || (location.pathname.endsWith('signup.html') && !name)) { message('Please complete all fields. Passwords must be at least 6 characters.'); return; }
    try { message(localMode ? 'Using local mode…' : 'Working…', false); if (location.pathname.endsWith('signup.html')) await signUp(email, password, name); else await logIn(email, password); location.href = resolvePagePath('dashboard.html'); }
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
  onUserChange(user => document.querySelectorAll('.buttons').forEach(nav => {
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
  }));
}
api.auth = { currentUser, signUp, logIn, signInWithGoogle, logOut, onUserChange, requireAuth, requireGuest, initAuthGuard, requestPasswordReset, isLocalMode: () => localMode };
initAuthGuard();
bindAuthForms(); bindNavbar();
