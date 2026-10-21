import('./config/firebase-config.js').then(async config => {
  const modules = await Promise.all([import('./modules/auth.js'), import('./modules/notes.js'), import('./modules/chat.js'), import('./modules/support.js')]);
  const notes = modules[1];
  purgeCachedSamples();
  notes.subscribeCommunityNotes();
  window.SmartNotes.auth?.onUserChange(() => { notes.renderCommunityFeed(); notes.renderMyUploadedNotes(); updateNavigation(); updateDashboardStats(); });
  updateNavigation();
  bindGlobalSearch();
  applySearchQuery();
  bindConversationSearch();
  updateDashboardStats();
  window.runSmartNotesDiagnostics = runDiagnostics;
}).catch(error => console.warn('SmartNotes modules unavailable:', error));

function applySearchQuery() {
  const search = document.querySelector('#community-search');
  if (!search) return;
  const query = new URLSearchParams(window.location.search).get('q');
  if (query) { search.value = query; search.dispatchEvent(new Event('input', { bubbles: true })); }
}
function bindConversationSearch() {
  const field = document.querySelector('#conversation-search');
  if (!field) return;
  field.addEventListener('input', () => window.SmartNotes?.chat?.renderConversationList(field.value));
  window.SmartNotes?.chat?.renderConversationList('');
}
async function updateDashboardStats() {
  const myNotes = document.querySelector('#stat-my-notes');
  if (!myNotes) return;
  const user = window.SmartNotes?.auth?.currentUser?.();
  const notes = await window.SmartNotes?.notes?.listCommunityNotes?.({}) || [];
  const owned = user ? notes.filter(note => note.uploaderId === user.uid) : [];
  myNotes.textContent = String(owned.length);
  const support = document.querySelector('#stat-support');
  if (support) support.textContent = `$${owned.reduce((total, note) => total + Number(note.supportTotal || 0), 0).toFixed(0)}`;
  const chats = document.querySelector('#stat-chats');
  if (chats) chats.textContent = String(Object.keys(JSON.parse(localStorage.getItem('smartnotes-local-chat') || '{}')).length);
  const greeting = document.querySelector('#dashboard-greeting');
  if (greeting && user) greeting.textContent = `Welcome back, ${user.displayName || user.email || 'Student'}`;
}

function purgeCachedSamples() {
  try {
    const key = 'smartnotes-local-notes';
    const notes = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(notes.filter(note => note?.isSample !== true && note?.sample !== true && note?.uploaderName !== 'SmartNotes team')));
  } catch (error) { console.warn('Cached note cleanup skipped:', error); }
}
function pagePath(page) { return window.location.pathname.includes('/pages/') ? page : `pages/${page}`; }
function updateNavigation() {
  const nav = document.querySelector('.nav-links');
  const user = window.SmartNotes?.auth?.currentUser?.();
  if (!nav || !user) return;
  nav.replaceChildren();
  [['dashboard.html', 'Dashboard'], ['notes.html', 'Notes'], ['chats.html', 'Chats'], ['templates.html', 'Templates'], ['blog.html', 'Blog']].forEach(([href, label]) => { const item = document.createElement('li'); const link = document.createElement('a'); link.href = pagePath(href); link.textContent = label; item.append(link); nav.append(item); });
}
function bindGlobalSearch() {
  const button = document.querySelector('[data-global-search]');
  if (!button || button.dataset.bound) return;
  button.dataset.bound = 'true';
  button.addEventListener('click', () => { const query = prompt('Search study notes'); if (query === null) return; const input = document.querySelector('#community-search'); if (input) { input.value = query; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); document.querySelector('#community')?.scrollIntoView({ behavior: 'smooth' }); } else window.location.href = `${pagePath('notes.html')}?q=${encodeURIComponent(query)}`; });
}
function runDiagnostics() {
  const notes = JSON.parse(localStorage.getItem(localNotesKey) || '[]');
  const chats = JSON.parse(localStorage.getItem(localChatKey) || '{}');
  const checks = [
    { check: 'Auth API loaded', pass: Boolean(window.SmartNotes?.auth?.currentUser) },
    { check: 'Notes API loaded', pass: Boolean(window.SmartNotes?.notes?.uploadNote) },
    { check: 'Realtime notes API loaded', pass: Boolean(window.SmartNotes?.notes?.subscribeCommunityNotes) },
    { check: 'Support modal binding', pass: Boolean(document.querySelector('#support-modal')) },
    { check: 'Chat drawer binding', pass: Boolean(document.querySelector('#chat-drawer')) },
    { check: 'Community feed binding', pass: Boolean(document.querySelector('#community-feed')) },
    { check: 'Local notes available', pass: notes.length > 0, details: `${notes.length} notes` },
    { check: 'Chat threads available', pass: Object.keys(chats).length > 0, details: `${Object.keys(chats).length} threads` },
    { check: 'No sample notes cached', pass: notes.every(note => note?.sample !== true && note?.uploaderName !== 'SmartNotes team'), details: `${notes.length} notes` }
  ];
  console.table(checks);
  return checks.every(item => item.pass);
}
