# SmartNotes

SmartNotes is a responsive, multi-page study and productivity notes website. It combines a clean landing page with authentication, study-file uploads, a searchable community notes feed, and student-to-student chat.

The project is currently a client-side web application. It can run in a browser with no backend setup by using its local fallback mode, or it can connect to Firebase Authentication and Cloud Firestore for shared accounts, notes, and conversations.

## Contents

- [Features](#features)
- [Application pages](#application-pages)
- [How the application works](#how-the-application-works)
- [Technology](#technology)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Firebase configuration](#firebase-configuration)
- [Local fallback mode](#local-fallback-mode)
- [Data model](#data-model)
- [Supported files and storage limits](#supported-files-and-storage-limits)
- [Diagnostics](#diagnostics)
- [Deployment](#deployment)
- [Security and production considerations](#security-and-production-considerations)
- [Troubleshooting](#troubleshooting)
- [Current limitations](#current-limitations)
- [Potential next steps](#potential-next-steps)

## Features

### Landing page

- Hero section with calls to action for signing up and exploring features.
- Navigation to Features, Templates, and Blog pages.
- Product showcase for notebooks, tasks, reminders, documents, and AI summaries.
- Responsive study-file upload area.
- Community study-notes feed with:
  - Text search across titles, descriptions, subjects, authors, and tags.
  - Subject filtering.
  - File-extension filtering.
  - A logged-in user's **My Notes** filter.
  - Authenticated downloads.
  - Author messaging.
  - Author-only note deletion, including associated Firestore file chunks.
- Real-time Firestore synchronization for notes and one-to-one conversations.
- Responsive chat drawer for conversations with note authors.

### Authentication

- Email/password sign-up.
- Email/password login.
- Google sign-in when Firebase is configured and authorized.
- Sign-out from the navigation bar.
- Authenticated and guest-only page flows.
- Local browser authentication fallback for development and demos.

### Study-file vault

Users can select or drag and drop multiple files into the upload widget. Each file can have:

- A title.
- A subject or category.
- Comma-separated tags.
- A short description.

Selecting files previews their names and sizes with per-file remove buttons. Nothing is published until the user clicks **Publish Upload Note**, which uploads each selected file and refreshes the community feed and "My Uploaded Notes" list.

Uploaded files are represented in the community feed and can be downloaded by signed-in users.

### Community notes

Community notes use a Firestore `onSnapshot` listener as the source of truth when Firebase is available, so uploads and deletions appear for other users without a refresh. In local mode they are loaded from browser storage. The feed supports search, subject/file-type filters, and a logged-in **My Notes** filter.

There are no seeded demo notes. When the collection is empty the grid renders a centered empty state: *"No study notes uploaded yet. Be the first student to share a resource!"* Any sample notes cached in a previous session are removed from browser storage on startup.

### Authenticated workspace

Signing in or signing up redirects to the student dashboard, which shows a personalized welcome banner, stat cards for uploaded notes and active chats, recent community notes, and the user's own uploads.

- **Dashboard** (`pages/dashboard.html`) — stats, quick upload, and recent notes.
- **My Notes** (`pages/notes.html`) — upload manager, "My Uploaded Notes" grid with free download and author-only delete, plus a full community browser.
- **Chats** (`pages/chats.html`) — full-page two-column chat with a searchable conversation list on the left and a live thread on the right.

While signed in, the navigation bar on every page shows **Dashboard**, **Notes**, **Chats**, **Templates**, and **Blog**. A **🔍** search button in the navbar focuses the community search field on the current page, or forwards the query to `pages/notes.html?q=...` on pages without a feed.

### Messaging

Users can open a conversation from a community note and send messages to its author. Firestore conversations update in real time. Local mode stores chat threads in `localStorage`.

### Downloads are free and direct. Signed-in users can download a community note with one click; the existing chunked file reconstruction remains unchanged.

## Application pages

| Page | Path | Purpose |
| --- | --- | --- |
| Home | `index.html` | Product landing page, file upload widget, and community feed |
| Dashboard | `pages/dashboard.html` | Authenticated student dashboard with stats, quick upload, and recent notes |
| My Notes | `pages/notes.html` | Upload manager with "My Uploaded Notes" and full community browsing |
| Chats | `pages/chats.html` | Full-screen two-column student chat workspace |
| Features | `pages/features.html` | Detailed feature overview and community experience |
| Templates | `pages/templates.html` | Workspace and note-template marketing page |
| Blog | `pages/blog.html` | Productivity and study-related editorial content |
| Login | `pages/login.html` | Existing-user sign-in |
| Sign up | `pages/signup.html` | New-user registration |

All pages share the main stylesheet and load the same Firebase, authentication, notes, chat, and application modules where needed.

## How the application works

1. The browser loads `js/config/firebase-config.js`.
2. If a usable Firebase configuration is available, the app initializes Firebase Authentication and Cloud Firestore.
3. If Firebase is unavailable, invalid, blocked by the current host, or opened in an unsupported environment, the app switches to local mode.
4. The page dynamically loads the feature modules through `js/script.js`.
5. No sample notes are seeded in either mode. Cached sample notes are purged from browser storage on startup, and an empty collection renders a centered empty-state card.
6. Authentication state controls uploads, downloads, messaging, note ownership controls, and the navigation buttons.
7. Authenticated sign-up, sign-in, Google sign-in, and auth-state restoration synchronize `users/{uid}` with `displayName`, `email`, and `updatedAt`.
8. Live Firestore permission or security-rule failures are surfaced to the user; they do not silently switch the app to local mode. Local fallback is reserved for missing configuration, invalid keys, or offline/network failures.

The app does not currently use Firebase Cloud Storage. File contents are stored as data URLs:

- Small files are stored inline with note metadata.
- Larger files are split into chunks and stored in IndexedDB locally or in a Firestore `chunks` subcollection when using Firebase.

## Technology

- Semantic HTML5.
- CSS3 with responsive layouts and custom components.
- Modern browser JavaScript using ES modules.
- Firebase Authentication.
- Cloud Firestore.
- `localStorage` for local sessions, metadata, and chat.
- IndexedDB for larger local file contents.
- Google Fonts Inter, loaded from Google Fonts.
- Firebase browser modules loaded from `gstatic.com`.

The repository contains a `package.json` with Firebase as a dependency, but the current browser modules import Firebase's hosted browser builds directly. There is no bundler, framework, or application build step at present.

## Project structure

```text
smart Notes Organizer/
├── index.html
├── pages/
│   ├── blog.html
│   ├── chats.html
│   ├── dashboard.html
│   ├── features.html
│   ├── login.html
│   ├── notes.html
│   ├── signup.html
│   └── templates.html
├── css/
│   └── style.css
├── js/
│   ├── config/
│   │   └── firebase-config.js
│   ├── modules/
│   │   ├── auth.js
│   │   ├── chat.js
│   │   ├── notes.js
│   └── script.js
├── assets/
│   └── images/
├── package.json
├── package-lock.json
└── README.md
```

### Module responsibilities

- `js/config/firebase-config.js` initializes Firebase, determines whether local mode is needed, and resolves links between root and `pages/` routes.
- `js/modules/auth.js` implements sign-up, login, Google sign-in, logout, auth state listeners, guest/auth guards, and navigation state.
- `js/modules/notes.js` validates, sanitizes, stores, subscribes to, filters, renders, deletes, and downloads study files, and renders the current user's uploaded notes.
- `js/modules/chat.js` manages the chat drawer, the full-page chat workspace, sanitized local threads, and Firestore message streams.
- `js/script.js` wires module startup, authenticated navigation, global search, cached sample cleanup, and diagnostics.
- `css/style.css` contains the shared visual system and responsive component styles.

## Getting started

### Requirements

- A modern browser with ES module, `localStorage`, IndexedDB, and drag-and-drop support.
- Node.js and npm are optional for the current static frontend, but useful for installing the declared dependency.
- A local HTTP server is recommended. Opening module pages directly with `file://` can trigger browser security restrictions.

### Run locally

1. Clone or download the repository.
2. Open a terminal in the project directory.
3. Optionally install the declared dependency:

   ```bash
   npm install
   ```

4. Start any static HTTP server. For example, with Python:

   ```bash
   python -m http.server 8000
   ```

5. Open [http://localhost:8000](http://localhost:8000).

Alternatively, use the Live Server extension in VS Code or another static-file server. No `npm start` script is currently defined.

### Try the local mode

The app can be tested without a Firebase project:

1. Open the site through a local HTTP server.
2. Create an account on the Sign up page.
3. Log in with that account.
4. Upload a supported study file.
5. Use the community feed to search, download, and message.

Local-mode data belongs to the current browser profile and is not shared with other browsers or users.

## Firebase configuration

The default configuration is in `js/config/firebase-config.js`. A page can override it before the Firebase module loads by defining:

```html
<script>
  window.SMART_NOTES_FIREBASE_CONFIG = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
  };
</script>
```

The override must appear before the Firebase configuration module is imported. For a production deployment, prefer injecting this configuration during deployment rather than editing source code per environment.

### Firebase project setup

1. Create a Firebase project.
2. Register a web app and copy its web configuration.
3. Enable **Authentication**.
4. Enable the **Email/Password** provider.
5. Enable **Google** if Google sign-in is required.
6. Create a **Cloud Firestore** database.
7. Add the deployed domain and local development domain to Firebase Authentication authorized domains.
8. Configure Firestore security rules before allowing untrusted users to write data.
9. Provide the configuration through `window.SMART_NOTES_FIREBASE_CONFIG`.

The app uses these Firestore paths:

```text
users/{uid}
notes/{noteId}
notes/{noteId}/chunks/{chunkIndex}
conversations/{conversationId}/messages/{messageId}
```

Firebase client configuration values such as `apiKey` identify a web application; they are not a replacement for Firestore rules or Authentication controls. Never treat the client configuration as a secret.

## Local fallback mode

Local mode is selected only when Firebase configuration is missing/placeholder, a Firebase API key is invalid, or the browser is offline / experiences a transient network failure. With valid configuration and a reachable Firebase service, Firestore remains the primary source of truth. Permission-denied and security-rule errors are not treated as permission to use local data; they are surfaced so the deployment can be corrected.

The following browser data is used:

| Data | Browser storage |
| --- | --- |
| Local accounts and current session | `localStorage` |
| Note metadata and small file data | `localStorage` |
| Larger file chunks | IndexedDB database `smartnotes-files` |
| Chat threads | `localStorage` |
| Support totals | `localStorage` |

The app does not seed demo notes. Any previously cached sample notes are purged from browser storage on startup. Local-mode passwords are stored in browser storage for demo purposes only and must not be used for real accounts.

## Data model

### User document

Stored at `users/{uid}`. The application writes the profile on sign-up and updates it after email/password login, Google login, and Firebase auth-state restoration:

```text
displayName
email
updatedAt            server timestamp
photoURL             optional
createdAt            legacy/optional server timestamp
lastLoginAt          legacy/optional server timestamp
```

### Note document

Stored at `notes/{noteId}`:

```text
title
description
subject
tags                 array of strings
fileName
extension
size
contentType
uploaderId
uploaderName
createdAt
storageMode          "inline" or "chunks"
fileDataUrl          present for small files
chunkCount           present for larger files
```

### Chat message

Stored at `conversations/{conversationId}/messages/{messageId}` and streamed with a Firestore `onSnapshot` listener while a conversation is open:

```text
senderId
recipientId
text
createdAt
```

Conversation IDs are deterministic: the two user IDs are sorted and joined with an underscore. This allows both participants to address the same conversation.

## Supported files and storage limits

Accepted extensions:

```text
PDF, DOC, DOCX, PPT, PPTX, JPG, JPEG, PNG, GIF, WEBP
```

The browser validates file extensions before upload. MIME types are retained as metadata but extension validation is the primary client-side check.

Storage behavior:

- Files up to approximately `700 KB` are stored inline.
- Larger files are split into approximately `500 KB` base64 chunks.
- Local large-file chunks use IndexedDB.
- Firebase large-file chunks use the note's Firestore `chunks` subcollection.

These limits are implementation details, not a substitute for server-side quotas, validation, or content scanning.

## Diagnostics

When the site is loaded, open the browser developer console and run:

```js
window.runSmartNotesDiagnostics()
```

The diagnostic checks verify:

- Authentication API availability.
- Notes API availability.
- Support modal binding.
- Chat drawer binding.
- Community feed binding.
- Seeded local notes.
- Seeded local chat threads.

The function prints a table and returns `true` only when every check passes.

## Deployment

SmartNotes is a static site and can be deployed to any host that serves HTML, CSS, JavaScript, and the `pages/` directory without rewriting paths incorrectly.

Suitable hosting options include:

- Firebase Hosting.
- GitHub Pages.
- Netlify.
- Vercel static hosting.
- Cloudflare Pages.
- Any conventional web server.

Before deployment:

1. Serve the project from the intended HTTPS domain.
2. Configure the Firebase web app for that domain.
3. Add the domain to Firebase Authentication authorized domains.
4. Set restrictive Firestore rules.
5. Test both guest and authenticated flows.
6. Confirm that all relative links work from both the root page and pages under `pages/`.

## Security and production considerations

The current repository is suitable for a prototype or educational demo, not a production data platform without additional backend controls.

Before production use:

- Replace local-mode authentication with a real identity system for deployed environments.
- Never store plaintext passwords. Local mode does this only to make offline demos work.
- Write and test Firestore rules for users, notes, chunks, and conversations.
- Enforce authorization on the server/database, not only through browser UI checks.
- Validate file size, MIME type, extension, and content server-side.
- Add malware/content scanning for uploaded files.
- Use a dedicated object-storage service for files rather than placing large base64 content in Firestore.
- Review privacy, retention, deletion, and copyright policies for community-shared files.
- Keep Firebase configuration environment-specific and avoid committing unrelated secrets.

## Troubleshooting

### The page is blank or modules do not load

Serve the project over HTTP instead of opening `index.html` directly with `file://`. Browser module and Firebase requests can be blocked from local files.

### The app says it is using local mode

Check that:

- The Firebase configuration is valid.
- The current hostname is an authorized Firebase Authentication domain.
- Firebase Authentication and Firestore are enabled.
- The configuration override is defined before the Firebase module loads.

Local mode is an intentional fallback and still supports basic demo flows.

### Uploads do not appear

- Sign in before uploading.
- Check that the extension is in the supported list.
- Confirm that the file input accepted the file.
- Check the upload status text and browser console.
- In Firebase mode, inspect Firestore permissions and indexes.

### Google sign-in fails

Enable the Google provider and add the current host to Firebase Authentication's authorized domains. Popup blockers can also prevent the provider window from opening.

### Community notes cannot be downloaded

Downloads require an authenticated user. In Firebase mode, verify that the note document and any required chunk documents are readable under the Firestore rules.

## Current limitations

- There is no application build pipeline or automated test suite.
- The Firebase configuration currently includes a default project configuration in source.
- Cloud Storage is intentionally not used.
- Tips are recorded in Firestore, but payment collection is not integrated; creator links are displayed for external payment.
- The UI describes AI-powered organization, but no AI classification or summarization service is wired into the current implementation.
- The local authentication fallback is for demos only.
- Client-side validation does not provide server-side security.
- Large files represented as base64 data can be inefficient and may encounter browser or Firestore quotas.
- Community note editing, reporting, moderation, and account deletion are not implemented.
- The full-page chat workspace lists local-mode conversations; a Firestore conversation index for all threads is not implemented.

## Potential next steps

- Add a bundler and environment-specific configuration.
- Move file content to Firebase Cloud Storage or another object-storage service.
- Add Firestore security rules and automated rules tests.
- Add server-side upload validation and scanning.
- Add note editing, deletion, moderation, and reporting.
- Add note versioning and richer search.
- Add an AI service for tagging, summaries, and semantic search.
- Add unit, integration, accessibility, and end-to-end tests.
- Add CI checks for formatting, linting, and deployment.

## License

No license file is currently included. Add an explicit license before distributing or reusing the project publicly.
