// Initialize Vercel Speed Insights
import { injectSpeedInsights } from '@vercel/speed-insights';
injectSpeedInsights();

import('./config/firebase-config.js').then(async config => {
  const modules = await Promise.all([import('./modules/auth.js'), import('./modules/notes.js'), import('./modules/chat.js'), import('./modules/support.js')]);
  const notes = modules[1];
  if (config.useLocalMode) seedLocalNotes();
  notes.subscribeCommunityNotes();
  window.SmartNotes.auth?.onUserChange(() => notes.renderCommunityFeed());
  window.runSmartNotesDiagnostics = runDiagnostics;
}).catch(error => console.warn('SmartNotes modules unavailable:', error));

const localNotesKey = 'smartnotes-local-notes';
const localChatKey = 'smartnotes-local-chat';
const sampleDataUrl = (content, type) => `data:${type};base64,${btoa(content)}`;
function seedLocalNotes() {
  try {
    if (JSON.parse(localStorage.getItem(localNotesKey) || '[]').length) return;
    const now = Date.now();
    const notes = [
      { id: 'demo-biology-pdf', title: 'Cell Biology Revision Pack', subject: 'Biology', tags: ['sample', 'revision'], extension: 'pdf', fileName: 'cell-biology.pdf', contentType: 'application/pdf', fileDataUrl: sampleDataUrl('SmartNotes Biology Revision Pack', 'application/pdf'), size: 32, uploaderId: 'demo-alex', uploaderName: 'Alex Johnson', sample: true, createdAt: now - 4000, storageMode: 'inline', description: 'Concise revision notes covering cells, membranes, and energy.' },
      { id: 'demo-history-pptx', title: 'Modern History Lecture Slides', subject: 'History', tags: ['sample', 'timeline'], extension: 'pptx', fileName: 'modern-history.pptx', contentType: 'text/plain', fileDataUrl: sampleDataUrl('SmartNotes History Slides', 'text/plain'), size: 30, uploaderId: 'demo-sam', uploaderName: 'Sam Patel', sample: true, createdAt: now - 3000, storageMode: 'inline', description: 'A quick timeline of major events and key historical themes.' },
      { id: 'demo-math-docx', title: 'Calculus Formula Guide', subject: 'Mathematics', tags: ['sample', 'formulas'], extension: 'docx', fileName: 'calculus-guide.docx', contentType: 'text/plain', fileDataUrl: sampleDataUrl('SmartNotes Calculus Formula Guide', 'text/plain'), size: 34, uploaderId: 'demo-maya', uploaderName: 'Maya Chen', sample: true, createdAt: now - 2000, storageMode: 'inline', description: 'Derivatives, integrals, and exam-ready calculus formulas.' },
      { id: 'demo-art-png', title: 'Anatomy Lab Diagram', subject: 'Health Science', tags: ['sample', 'anatomy'], extension: 'png', fileName: 'anatomy-diagram.png', contentType: 'text/plain', fileDataUrl: sampleDataUrl('SmartNotes Anatomy Diagram', 'text/plain'), size: 28, uploaderId: 'demo-noah', uploaderName: 'Noah Williams', sample: true, createdAt: now - 1000, storageMode: 'inline', description: 'A labeled anatomy diagram for quick lab revision.' }
    ];
    localStorage.setItem(localNotesKey, JSON.stringify(notes));
    const chats = JSON.parse(localStorage.getItem(localChatKey) || '{}');
    chats['local-google-user_demo-alex'] ||= [{ senderId: 'demo-alex', recipientId: 'local-google-user', text: 'Welcome to SmartNotes! Ask me anything about the study notes.', createdAt: Date.now() }];
    localStorage.setItem(localChatKey, JSON.stringify(chats));
  } catch (error) { console.warn('Local demo seeding skipped:', error); }
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
    { check: 'Chat threads available', pass: Object.keys(chats).length > 0, details: `${Object.keys(chats).length} threads` }
  ];
  console.table(checks);
  return checks.every(item => item.pass);
}
