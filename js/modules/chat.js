import { auth, db, firebaseReady, isLocalFallbackError } from '../config/firebase-config.js';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const api = window.SmartNotes ||= {};
const CHAT_KEY = 'smartnotes-local-chat';
let localMode = !firebaseReady;
let unsubscribe;
let unsubscribeConversations;
let activePartner;
let cachedFirestoreConversations = [];
const conversationId = (a, b) => [a, b].sort().join('_');
const activeUser = () => localMode ? api.auth?.currentUser?.() : auth?.currentUser;
const readChats = () => { try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || {}; } catch { return {}; } };
const saveChats = chats => localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
const sanitizeText = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 2000);
const setLoading = loading => { document.querySelector('#chat-drawer')?.classList.toggle('is-loading', loading); document.querySelector('.chat-page-thread')?.classList.toggle('is-loading', loading); };
const renderMessages = (messages, partnerName) => { const user = activeUser(); const box = document.querySelector('#chat-messages'); if (!box || !user) return; box.replaceChildren(); if (!messages.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'No messages yet.'; box.append(empty); return; } messages.forEach(message => { const paragraph = document.createElement('p'); paragraph.className = `chat-message ${message.senderId === user.uid ? 'mine' : ''}`; const strong = document.createElement('strong'); strong.textContent = `${message.senderId === user.uid ? 'You' : partnerName}: `; paragraph.append(strong, document.createTextNode(sanitizeText(message.text))); box.append(paragraph); }); box.scrollTop = box.scrollHeight; };
export function openChat(partnerId, partnerName = 'Student') { const user = activeUser(); if (!user) return Promise.reject(new Error('Sign in to chat.')); const drawer = document.querySelector('#chat-drawer'); const chatPage = document.querySelector('.chat-page'); if (chatPage) { chatPage.dataset.partnerId = partnerId; } else { drawer?.setAttribute('aria-hidden', 'false'); drawer?.classList.add('is-open'); } const partnerLabel = document.querySelector('#chat-partner'); if (partnerLabel) partnerLabel.textContent = sanitizeText(partnerName, 120); const id = conversationId(user.uid, partnerId); activePartner = { id, partnerId, partnerName: sanitizeText(partnerName, 120) }; if (drawer) drawer.dataset.partnerId = partnerId; unsubscribe?.(); setLoading(true); if (localMode) { renderMessages(readChats()[id] || [], activePartner.partnerName); setLoading(false); return Promise.resolve(id); } unsubscribe = onSnapshot(query(collection(db, 'conversations', id, 'messages'), orderBy('createdAt')), snapshot => { renderMessages(snapshot.docs.map(item => item.data()), activePartner.partnerName); setLoading(false); }, error => { setLoading(false); if (isLocalFallbackError(error)) { localMode = true; renderMessages(readChats()[id] || [], activePartner.partnerName); } else { console.error(error); const box = document.querySelector('#chat-messages'); if (box) box.textContent = 'Unable to load this conversation.'; } }); return Promise.resolve(id); }
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
    renderConversationList();
    return message;
  }
  try {
    const convRef = doc(db, 'conversations', id);
    await setDoc(convRef, {
      participants: [user.uid, partnerId],
      participantNames: {
        [user.uid]: user.displayName || user.email || 'Student',
        [partnerId]: activePartner?.partnerName || 'Student'
      },
      lastMessage: safeText,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return await addDoc(collection(db, 'conversations', id, 'messages'), { ...message, createdAt: serverTimestamp() });
  } catch (error) {
    if (!isLocalFallbackError(error)) throw error;
    localMode = true;
    return sendMessage(partnerId, safeText);
  }
}
export function closeChat() { unsubscribe?.(); unsubscribe = null; document.querySelector('#chat-drawer')?.classList.remove('is-open'); document.querySelector('#chat-drawer')?.setAttribute('aria-hidden', 'true'); }
export function bindChat() { document.querySelector('[data-close-chat]')?.addEventListener('click', closeChat); document.querySelector('#chat-form')?.addEventListener('submit', async event => { event.preventDefault(); const input = document.querySelector('#chat-input'); const partner = document.querySelector('.chat-page')?.dataset.partnerId || document.querySelector('#chat-drawer')?.dataset.partnerId; const button = event.currentTarget.querySelector('button[type="submit"]'); try { button.disabled = true; await sendMessage(partner, input.value); input.value = ''; } catch (error) { console.error(error); } finally { button.disabled = false; } }); }
export function subscribeConversations() {
  const user = activeUser();
  if (!user || localMode) return () => {};
  unsubscribeConversations?.();
  const q = query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid));
  unsubscribeConversations = onSnapshot(q, snapshot => {
    cachedFirestoreConversations = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderConversationList();
  }, error => {
    if (isLocalFallbackError(error)) {
      localMode = true;
      renderConversationList();
    } else {
      console.warn('Unable to subscribe conversations:', error);
    }
  });
  return unsubscribeConversations;
}
export function renderConversationList(search = '') {
  const list = document.querySelector('#conversation-list');
  if (!list) return;
  const user = activeUser();
  if (!user) return;
  const term = String(search || '').toLowerCase();
  let threads = [];
  if (localMode) {
    threads = Object.entries(readChats()).map(([id, messages]) => {
      const partnerId = id.split('_').find(part => part !== user.uid) || 'Student';
      const lastMsg = messages[messages.length - 1];
      return {
        id,
        partnerId,
        name: partnerId,
        lastMessage: lastMsg?.text || '',
        updatedAt: lastMsg?.createdAt || 0
      };
    });
  } else {
    threads = cachedFirestoreConversations.map(conv => {
      const partnerId = (conv.participants || []).find(uid => uid !== user.uid) || 'Student';
      const name = conv.participantNames?.[partnerId] || partnerId || 'Student';
      const timestamp = conv.updatedAt?.toMillis ? conv.updatedAt.toMillis() : (conv.updatedAt || 0);
      return {
        id: conv.id,
        partnerId,
        name,
        lastMessage: conv.lastMessage || '',
        updatedAt: timestamp
      };
    });
  }
  threads.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  list.replaceChildren();
  const visible = threads.filter(thread => !term || thread.name.toLowerCase().includes(term) || (thread.lastMessage && thread.lastMessage.toLowerCase().includes(term)));
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No conversations yet. Message a note author to start one.';
    list.append(empty);
    return;
  }
  visible.forEach(thread => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'conversation-item';
    const titleSpan = document.createElement('strong');
    titleSpan.textContent = thread.name;
    const msgPreview = document.createElement('span');
    msgPreview.style.display = 'block';
    msgPreview.style.fontSize = '11px';
    msgPreview.style.color = 'var(--muted)';
    msgPreview.textContent = thread.lastMessage || 'Open conversation';
    item.append(titleSpan, msgPreview);
    item.addEventListener('click', () => openChat(thread.partnerId, thread.name));
    list.append(item);
  });
}
api.chat = { openChat, sendMessage, closeChat, renderConversationList, subscribeConversations };
bindChat();
