import('./config/firebase-config.js').then(() => Promise.all([import('./modules/auth.js'), import('./modules/notes.js'), import('./modules/chat.js'), import('./modules/support.js')])).catch(error => console.warn('SmartNotes modules unavailable:', error));

const acceptedExtensions = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "jpg", "jpeg", "png", "gif", "webp"
]);

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getExtension = (name) => name.split(".").pop().toLowerCase();

document.querySelectorAll("[data-upload-widget]").forEach((widget) => {
  const input = widget.querySelector(".file-input");
  const dropZone = widget.querySelector(".drop-zone");
  const status = widget.querySelector(".upload-status");
  const list = widget.querySelector(".file-list");
  const uploadedFiles = [];

  const renderFiles = () => {
    list.innerHTML = "";
    uploadedFiles.forEach((file, index) => {
      const item = document.createElement("li");
      item.className = "file-item";
      item.innerHTML = `
        <span class="file-badge">${getExtension(file.name).toUpperCase()}</span>
        <span class="file-details"><strong>${file.name}</strong><small>${formatBytes(file.size)}</small></span>
        <button type="button" aria-label="Remove ${file.name}" data-file-index="${index}">×</button>
      `;
      list.appendChild(item);
    });
  };

  const addFiles = (files) => {
    const rejected = [];
    Array.from(files).forEach((file) => {
      if (acceptedExtensions.has(getExtension(file.name))) {
        if (!uploadedFiles.some((existing) => existing.name === file.name && existing.size === file.size)) {
          uploadedFiles.push(file);
        }
      } else {
        rejected.push(file.name);
      }
    });
    renderFiles();
    if (rejected.length) {
      status.textContent = `Skipped unsupported file${rejected.length > 1 ? "s" : ""}: ${rejected.join(", ")}`;
      status.className = "upload-status error";
    } else if (files.length) {
      status.textContent = `${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"} ready in your study vault.`;
      status.className = "upload-status success";
    }
  };

  input.addEventListener("change", (event) => addFiles(event.target.files));
  dropZone.addEventListener("click", () => input.click());
  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });
  dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-file-index]");
    if (!button) return;
    uploadedFiles.splice(Number(button.dataset.fileIndex), 1);
    renderFiles();
    status.textContent = uploadedFiles.length ? `${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"} ready in your study vault.` : "";
  });
});

const QA_NOTES_KEY = 'smartnotes-local-notes';
const QA_CHAT_KEY = 'smartnotes-local-chat';

const sampleDataUrl = (content, type) => `data:${type};base64,${btoa(content)}`;
const seedNotes = () => {
  try {
    if (JSON.parse(localStorage.getItem(QA_NOTES_KEY) || '[]').length) return;
    const now = Date.now();
    const notes = [
      { id: 'demo-biology-pdf', title: 'Cell Biology Revision Pack', subject: 'Biology', tags: ['cells', 'revision', 'exam'], extension: 'pdf', fileName: 'cell-biology.pdf', contentType: 'application/pdf', fileDataUrl: sampleDataUrl('SmartNotes Biology Revision Pack', 'application/pdf'), size: 32, uploaderId: 'demo-alex', uploaderName: 'Alex Johnson', supportTotal: 8, createdAt: now - 4000, storageMode: 'inline', description: 'Concise revision notes covering cells, membranes, and energy.' },
      { id: 'demo-history-pptx', title: 'Modern History Lecture Slides', subject: 'History', tags: ['lecture', 'timeline', 'modern-history'], extension: 'pptx', fileName: 'modern-history.pptx', contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', fileDataUrl: sampleDataUrl('SmartNotes History Slides', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), size: 30, uploaderId: 'demo-sam', uploaderName: 'Sam Patel', supportTotal: 12, createdAt: now - 3000, storageMode: 'inline', description: 'A quick timeline of major events and key historical themes.' },
      { id: 'demo-math-docx', title: 'Calculus Formula Guide', subject: 'Mathematics', tags: ['calculus', 'formulas', 'study-guide'], extension: 'docx', fileName: 'calculus-guide.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileDataUrl: sampleDataUrl('SmartNotes Calculus Formula Guide', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), size: 34, uploaderId: 'demo-maya', uploaderName: 'Maya Chen', supportTotal: 5, createdAt: now - 2000, storageMode: 'inline', description: 'Derivatives, integrals, and exam-ready calculus formulas.' },
      { id: 'demo-art-png', title: 'Anatomy Lab Diagram', subject: 'Health Science', tags: ['anatomy', 'diagram', 'lab'], extension: 'png', fileName: 'anatomy-diagram.png', contentType: 'image/png', fileDataUrl: sampleDataUrl('SmartNotes Anatomy Diagram', 'image/png'), size: 28, uploaderId: 'demo-noah', uploaderName: 'Noah Williams', supportTotal: 3, createdAt: now - 1000, storageMode: 'inline', description: 'A labeled anatomy diagram for quick lab revision.' }
    ];
    localStorage.setItem(QA_NOTES_KEY, JSON.stringify(notes));
  } catch (error) { console.warn('Demo note seeding skipped:', error); }
};

const seedWelcomeChat = () => {
  try {
    const chats = JSON.parse(localStorage.getItem(QA_CHAT_KEY) || '{}');
    const key = 'local-google-user_demo-alex';
    if (!chats[key]) chats[key] = [{ senderId: 'demo-alex', recipientId: 'local-google-user', text: 'Welcome to SmartNotes! Ask me anything about the study notes.', createdAt: Date.now() }];
    localStorage.setItem(QA_CHAT_KEY, JSON.stringify(chats));
  } catch (error) { console.warn('Welcome chat seeding skipped:', error); }
};

const runDiagnostics = () => {
  const notes = JSON.parse(localStorage.getItem(QA_NOTES_KEY) || '[]');
  const chats = JSON.parse(localStorage.getItem(QA_CHAT_KEY) || '{}');
  const checks = [
    { check: 'Auth API loaded', pass: Boolean(window.SmartNotes?.auth?.currentUser) },
    { check: 'Notes API loaded', pass: Boolean(window.SmartNotes?.notes?.uploadNote) },
    { check: 'Support modal binding', pass: Boolean(document.querySelector('#support-modal')) },
    { check: 'Chat drawer binding', pass: Boolean(document.querySelector('#chat-drawer')) },
    { check: 'Community feed binding', pass: Boolean(document.querySelector('#community-feed')) },
    { check: 'Local notes available', pass: notes.length > 0, details: `${notes.length} notes` },
    { check: 'Chat threads available', pass: Object.keys(chats).length > 0, details: `${Object.keys(chats).length} threads` }
  ];
  console.table(checks);
  return checks.every(item => item.pass);
};

seedNotes();
seedWelcomeChat();
window.runSmartNotesDiagnostics = runDiagnostics;


