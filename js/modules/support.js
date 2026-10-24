import { db, firebaseReady, isLocalFallbackError } from '../config/firebase-config.js';
import { addDoc, collection, doc, getDoc, getDocs, increment, query, serverTimestamp, updateDoc, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const api = window.SmartNotes ||= {};
let pendingCallback;
const supportKey = note => `smartnotes-support-${note?.id || 'unknown'}`;
const readSupport = note => Number(localStorage.getItem(supportKey(note)) || 0);
const formatLink = value => String(value || '').trim();
export function openSupportModal(note, callback) { pendingCallback = callback; const modal = document.querySelector('#support-modal'); if (!modal) return callback?.(new Error('Support modal is unavailable.')); if (!api.auth?.currentUser()) { alert('Please log in before downloading community notes.'); return; } modal.dataset.note = JSON.stringify(note || {}); modal.setAttribute('aria-hidden', 'false'); modal.classList.add('is-open'); }
export function closeSupportModal() { const modal = document.querySelector('#support-modal'); modal?.setAttribute('aria-hidden', 'true'); modal?.classList.remove('is-open'); pendingCallback = null; }
async function recordContribution(note, amount) {
  if (!amount) return;
  const user = api.auth?.currentUser();
  if (!(firebaseReady && db && user && !String(user.uid).startsWith('local-'))) {
    localStorage.setItem(supportKey(note), String(readSupport(note) + amount));
    return;
  }
  try {
    let noteId = note.firestoreDocId || note.id;
    let noteSnapshot = await getDoc(doc(db, 'notes', noteId));
    if (!noteSnapshot.exists() && note.id) {
      const matches = await getDocs(query(collection(db, 'notes'), where('id', '==', note.id)));
      noteId = matches.docs[0]?.id || '';
      if (!noteId) throw new Error('The note could not be found.');
      noteSnapshot = await getDoc(doc(db, 'notes', noteId));
    }
    await addDoc(collection(db, 'notes', noteId, 'contributions'), { amount, supporterId: user.uid, creatorId: note.uploaderId, createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'notes', noteId), { supportTotal: increment(amount) });
  } catch (error) {
    if (!isLocalFallbackError(error)) throw error;
    localStorage.setItem(supportKey(note), String(readSupport(note) + amount));
  }
}
export function bindSupportModal() { document.querySelectorAll('[data-tip]').forEach(button => button.addEventListener('click', () => { const input = document.querySelector('#custom-tip'); if (input) input.value = button.dataset.tip; })); document.querySelector('[data-close-support]')?.addEventListener('click', closeSupportModal); document.querySelector('#confirm-support')?.addEventListener('click', async () => { const amount = Number(document.querySelector('#custom-tip')?.value || 0); const status = document.querySelector('#support-status'); const note = JSON.parse(document.querySelector('#support-modal')?.dataset.note || '{}'); if (!Number.isFinite(amount) || amount < 0) { if (status) status.textContent = 'Enter a valid amount.'; return; } const link = formatLink(note.creatorSupportLink); try { document.querySelector('#confirm-support').disabled = true; if (amount > 0) { await recordContribution(note, amount); if (status) status.textContent = link ? `Support recorded. Pay the creator at ${link}` : 'Support recorded. Checkout is simulated because this creator did not provide a payment link.'; } else if (status) status.textContent = 'Free download confirmed.'; if (api.notes?.downloadNoteFile) await api.notes.downloadNoteFile(note); pendingCallback?.(null, { amount, note }); setTimeout(closeSupportModal, amount > 0 ? 1400 : 200); } catch (error) { if (status) status.textContent = error.message || 'Could not record support.'; pendingCallback?.(error); } finally { document.querySelector('#confirm-support').disabled = false; } }); }
api.support = { openSupportModal, closeSupportModal }; bindSupportModal();
