# SmartNotes Backend Plan

## Purpose and scope

The backend will add trusted server-side capabilities without replacing Firebase's existing identity and collaboration features. Every protected request will verify a Firebase ID token, derive the user identity from that token, and ignore client-supplied user IDs.

| Area | System | Reason |
|---|---|---|
| Sign-in, profiles, community feed, and realtime chat | Firebase Auth and Firestore | These flows already use Firebase's realtime and rules-based model. |
| File upload coordination, validation, processing, and readiness | FastAPI backend with Firebase Storage | Server-side validation must inspect the real object, not client metadata. |
| Moderation and takedowns | FastAPI plus Firestore | Administrative actions need trusted role checks and audit records. |
| Account deletion and export | FastAPI plus Firebase Admin SDK | Deletion and export span Auth, Firestore, Storage, and audit data. |
| Rate limiting and abuse controls | FastAPI and a production rate-limit store | Limits must be enforced outside an untrusted browser. |

## Proposed layout

```text
backend/
├── requirements.txt
├── README.md
├── app/
│   ├── main.py
│   ├── config.py
│   ├── auth.py
│   ├── routes/
│   │   ├── files.py
│   │   ├── moderation.py
│   │   └── accounts.py
│   └── services/
│       ├── files.py
│       ├── moderation.py
│       └── accounts.py
└── tests/
    ├── test_auth.py
    ├── test_files.py
    ├── test_moderation.py
    └── test_accounts.py
```

`main.py` should assemble the application and routers. `config.py` owns environment settings. `auth.py` verifies tokens and exposes role checks. Routes describe HTTP contracts, while services contain Storage, Firestore, moderation, and account workflows. Tests use mocked Firebase Admin clients and never require production credentials.

## API contract

| Method and path | Auth | Request fields | Response |
|---|---|---|---|
| `POST /files/upload-url` | Verified user | `filename`, `contentType`, `size`, optional `noteId` | Signed upload URL, object path, upload ID, expiry. |
| `POST /files/{id}/complete` | Verified user | `objectPath`, `title`, `subject`, `tags`, `description` | Accepted processing job and note ID; server derives uploader ID. |
| `POST /reports` | Verified user | `noteId`, `reason`, optional `details` | Report ID and queued status. |
| `POST /admin/notes/{id}/takedown` | Verified admin | `reason`, optional `details` | Takedown status and audit ID. |
| `DELETE /account` | Verified user | Optional confirmation token | Deletion job/status; identity comes from the token. |
| `GET /account/export` | Verified user | None | Export job/status or a signed, expiring download URL. |
| `GET /health` | None | None | Service health and version information. |
| `GET /me` | Verified user | None | Token-derived `uid` and email. |

All request fields require length, type, and size limits. Client-supplied `uid`, `uploaderId`, `senderId`, or role fields are ignored or rejected. Responses should avoid exposing internal Storage paths or moderation details to unauthorized users.

## Upload and processing flow

The browser first requests `POST /files/upload-url` with file metadata. The backend authenticates the request, applies quotas and an allowlist, creates a short-lived signed URL for Firebase Storage, and returns an upload identifier. The browser uploads directly to Firebase Storage.

The browser then calls `POST /files/{id}/complete`. The backend checks that the object belongs to the token-derived user and validates the actual object type and byte size from Storage. It must not rely on the browser's MIME type or size. A worker or bounded background task creates a thumbnail where applicable, extracts text using approved parsers, records processing errors, and marks the note ready only after validation and processing finish. A note that fails validation remains quarantined or is deleted.

## Authentication, roles, and auditing

FastAPI verifies `Authorization: Bearer <Firebase ID token>` with `firebase_admin.auth.verify_id_token`. The decoded `uid` is the only identity used for ownership, writes, exports, and deletion. Admin access is granted by a one-off operator script that sets Firebase custom claims; the browser cannot grant itself a role. Tokens must be refreshed after a claim change, and revoked users should be rejected where revocation checking is enabled.

An audit record should contain an immutable event ID, UTC timestamp, actor UID, actor email snapshot when appropriate, action, target type and ID, reason, request correlation ID, source IP or privacy-safe network identifier, result, and relevant before/after hashes or state references. Secrets, raw tokens, and unnecessary personal data must never be logged.

## Firestore and Storage data model

Existing `notes/{noteId}` documents should gain server-owned fields such as `status` (`processing`, `ready`, `rejected`, `taken_down`), `storageObject`, `contentType`, `byteSize`, `thumbnailObject`, `extractedTextObject`, `processedAt`, and `processingError`. `uploaderId` and size-related fields must be written or finalized by trusted code. Add `reports/{reportId}`, `moderationActions/{actionId}`, and `auditLogs/{eventId}` with restrictive rules. Conversations remain participant-controlled, but moderation and account workflows use Admin SDK operations.

New uploads should use one Storage object per file plus derived thumbnail and extracted-text objects under a server-generated user path. Existing chunked notes require a migration that reads each ordered chunk, reconstructs and validates the file, writes a Storage object and metadata, generates derived artifacts, updates the note status, and deletes chunks only after a successful verification. The migration must be resumable, idempotent, observable, and protected from concurrent edits.

## Hosting and operations

Deploy the FastAPI service to Cloud Run with a service account limited to the required Firebase Admin permissions. The Firebase project must use the Blaze plan because Cloud Run, Storage operations, and production server workloads can incur usage-based charges. Store configuration in Secret Manager or Cloud Run environment configuration, not in the repository. Configure request timeouts, concurrency, regional placement, structured logs, alerting, and a separate worker strategy for expensive extraction.

## Risks and open questions

The main risks are malicious files, parser vulnerabilities, unbounded extraction work, Storage URL leakage, duplicate completion requests, inconsistent account deletion, and rate-limit bypass through multiple clients. File processing should be isolated and bounded; signed URLs should expire quickly; completion must be idempotent; and deletion must have a retryable state machine.

Open questions remain around the accepted file formats and parser licenses, maximum extraction duration, thumbnail formats, retention of rejected files, whether exports are synchronous or queued, the rate-limit datastore, admin approval and break-glass procedures, regional data residency, privacy retention periods, and whether Cloud Tasks or a separate worker service will process files. The migration also needs a final policy for notes that cannot be reconstructed from their existing chunks.
