import { auth, db, firebaseReady, isLocalFallbackError } from '../config/firebase-config.js';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const api = window.SmartNotes ||= {};
const CHAT_KEY = 'smartnotes-local-chat';
let localMode = !firebaseReady;
let unsubscribe;
let activePartner;
const conversationId = (a, b) => [a, b].sort().join('_');
const activeUser = () => localMode ? api.auth?.currentUser?.() : auth?.currentUser;
const readChats = () => { try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || {}; } catch { return {}; } };
const saveChats = chats => localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
const sanitizeText = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 2000);
const setLoading = loading => document.querySelector('#chat-drawer')?.classList.toggle('is-loading', loading);
const renderMessages = (messages, partnerName) => { const user = activeUser(); const box = document.querySelector('#chat-messages'); if (!box || !user) return; box.replaceChildren(); if (!messages.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'No messages yet.'; box.append(empty); return; } messages.forEach(message => { const paragraph = document.createElement('p'); paragraph.className = `chat-message ${message.senderId === user.uid ? 'mine' : ''}`; const strong = document.createElement('strong'); strong.textContent = `${message.senderId === user.uid ? 'You' : partnerName}: `; paragraph.append(strong, document.createTextNode(sanitizeText(message.text))); box.append(paragraph); }); box.scrollTop = box.scrollHeight; };
export function openChat(partnerId, partnerName = 'Student') { const user = activeUser(); if (!user) return Promise.reject(new Error('Sign in to chat.')); const drawer = document.querySelector('#chat-drawer'); drawer?.setAttribute('aria-hidden', 'false'); drawer?.classList.add('is-open'); document.querySelector('#chat-partner').textContent = sanitizeText(partnerName, 120); const id = conversationId(user.uid, partnerId); activePartner = { id, partnerId, partnerName: sanitizeText(partnerName, 120) }; if (drawer) drawer.dataset.partnerId = partnerId; unsubscribe?.(); setLoading(true); if (localMode) { renderMessages(readChats()[id] || [], activePartner.partnerName); setLoading(false); return Promise.resolve(id); } unsubscribe = onSnapshot(query(collection(db, 'conversations', id, 'messages'), orderBy('createdAt')), snapshot => { renderMessages(snapshot.docs.map(item => item.data()), activePartner.partnerName); setLoading(false); }, error => { setLoading(false); if (isLocalFallbackError(error)) { localMode = true; renderMessages(readChats()[id] || [], activePartner.partnerName); } else { console.error(error); document.querySelector('#chat-messages').textContent = 'Unable to load this conversation.'; } }); return Promise.resolve(id); }
export async function sendMessage(partnerId, text) {
  const user = activeUser();
  const safeText = sanitizeText(text);
  if (!user || !safeText) throw new Error('Message cannot be empty.');
  const id = conversationId(user.uid, partnerId);
  const message = { senderId: user.uid, recipientId: partnerId, text: safeText, createdAt: Date.now() };
  if (localMode) {
    const chats = readChats();
    chats[id] = [...(chats[id] || []), message];
    saveChats(chats);
    renderMessages(chats[id], activePartner?.partnerName || 'Student');
    return message;
  }
  try {
    return await addDoc(collection(db, 'conversations', id, 'messages'), { ...message, createdAt: serverTimestamp() });
  } catch (error) {
    if (!isLocalFallbackError(error)) throw error;
    localMode = true;
    return sendMessage(partnerId, safeText);
  }
}
export function closeChat() { unsubscribe?.(); unsubscribe = null; document.querySelector('#chat-drawer')?.classList.remove('is-open'); document.querySelector('#chat-drawer')?.setAttribute('aria-hidden', 'true'); }
export function bindChat() { document.querySelector('[data-close-chat]')?.addEventListener('click', closeChat); document.querySelector('#chat-form')?.addEventListener('submit', async event => { event.preventDefault(); const input = document.querySelector('#chat-input'); const partner = document.querySelector('#chat-drawer')?.dataset.partnerId; const button = event.currentTarget.querySelector('button[type="submit"]'); try { button.disabled = true; await sendMessage(partner, input.value); input.value = ''; } catch (error) { console.error(error); } finally { button.disabled = false; } }); }
api.chat = { openChat, sendMessage, closeChat }; bindChat();
