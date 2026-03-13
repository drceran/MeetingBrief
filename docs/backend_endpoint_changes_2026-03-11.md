# Backend Endpoint Changes (March 11, 2026)

This document summarizes the backend implementation work completed for:
- Supabase JWT auth verification
- Meeting record creation
- Direct audio upload endpoint for local/client flows
- Upload webhook endpoint

It is intended as a handoff/reference for code review and team collaboration.

## Summary of What Was Implemented

### 1) Auth verification endpoint
- Added `GET /auth/verify`
- Validates `Authorization: Bearer <supabase_jwt>` using `SUPABASE_JWT_SECRET`
- Returns a minimal authenticated user payload (`id`, `email`, `role`)

### 2) Meeting record creation endpoint
- Added/updated `POST /meetings/`
- Requires authenticated user (`CurrentUser` dependency)
- Creates a DB-backed `Meeting` row
- Persists:
  - `id` (UUID string)
  - `user_id` (from JWT `sub`)
  - `audio_url`
  - `duration_seconds`
  - `status` (`uploaded`)
  - `title` (optional)
  - `created_at`

### 3) Upload webhook endpoint
- Added `POST /meetings/upload/webhook`
- Accepts meeting upload updates (`meeting_id`, optional `audio_url`, optional `duration_seconds`, `status`)
- Optional security via `X-Webhook-Secret` header if `UPLOAD_WEBHOOK_SECRET` is configured
- Validates status (`uploaded` or `processed`)

### 4) Direct audio upload endpoint
- Added `POST /meetings/upload`
- Accepts multipart form data with `audio`, `duration_seconds`, and optional `title`
- Stores audio locally for development and returns a created meeting record with a served `audio_url`
- Supports local-only auth bypass when `DEV_AUTH_USER_ID` is configured and no bearer token is provided

## Files Changed

### API wiring
- `backend/main.py`
  - Registers auth router (`/auth`) and meetings router (`/meetings`)
  - Adds CORS support for browser clients and mounts local `/media` serving

### Auth
- `backend/routers/auth.py`
  - Implements `GET /auth/verify`
- `backend/auth.py`
  - Existing Supabase JWT verification dependency (`CurrentUser`) is now used by route handlers
  - Adds optional `DEV_AUTH_USER_ID` fallback for local upload/get flows when no bearer token is supplied

### Meetings + DB
- `backend/routers/meetings.py`
  - DB-backed create/get meeting endpoints
  - Upload webhook endpoint
- `backend/db.py`
  - Added `get_db()` async dependency for route-level DB sessions
- `backend/models.py`
  - `Meeting` model expanded to include upload/auth fields

### Docs/Config
- `backend/.env.example`
  - Documents upload, CORS, media, and local dev auth settings
- `backend/README.md`
  - Added endpoint listing

## API Contracts

## `GET /auth/verify`

### Request
- Header: `Authorization: Bearer <jwt>`

### Success Response (200)
```json
{
  "authenticated": true,
  "user": {
    "id": "<supabase-user-id>",
    "email": "user@example.com",
    "role": "authenticated"
  }
}
```

### Failure Cases
- `401` missing/invalid/expired token

---

## `POST /meetings/`

### Request
- Header: `Authorization: Bearer <jwt>`
- Body:
```json
{
  "audio_url": "https://...",
  "duration_seconds": 120,
  "title": "Weekly Standup"
}
```

### Success Response (200)
```json
{
  "id": "<meeting-uuid>",
  "user_id": "<supabase-user-id>",
  "status": "uploaded",
  "audio_url": "https://...",
  "duration_seconds": 120,
  "title": "Weekly Standup",
  "created_at": "2026-03-11T..."
}
```

### Validation/Failure Cases
- `401` unauthenticated
- `422` invalid body (`duration_seconds` must be `> 0`)

---

## `GET /meetings/{meeting_id}`

### Request
- Header: `Authorization: Bearer <jwt>`
- Local development alternative: omit the header and set `DEV_AUTH_USER_ID` on the backend

### Behavior
- Returns the meeting only if the authenticated user owns it (`meeting.user_id == jwt.sub`)

### Failure Cases
- `404` meeting not found or not owned by caller

---

## `POST /meetings/upload`

### Request
- Header: `Authorization: Bearer <jwt>`
- Local development alternative: omit the header and set `DEV_AUTH_USER_ID` on the backend
- Body: `multipart/form-data`
  - `audio`: uploaded audio file
  - `duration_seconds`: integer, must be `> 0`
  - `title`: optional string

### Success Response (200)
```json
{
  "id": "<meeting-uuid>",
  "user_id": "<supabase-user-id-or-dev-user-id>",
  "status": "uploaded",
  "audio_url": "http://localhost:8000/media/<file>",
  "duration_seconds": 120,
  "title": "Weekly Standup",
  "created_at": "2026-03-12T..."
}
```

### Validation/Failure Cases
- `400` uploaded file is not an audio content type
- `401` unauthenticated when local dev auth fallback is not configured
- `422` invalid or missing form fields

---

## `POST /meetings/upload/webhook`

### Request
- Optional Header (when secret configured): `X-Webhook-Secret: <secret>`
- Body:
```json
{
  "meeting_id": "<meeting-uuid>",
  "audio_url": "https://...",
  "duration_seconds": 120,
  "status": "processed"
}
```

### Success Response (200)
```json
{
  "id": "<meeting-uuid>",
  "status": "processed"
}
```

### Validation/Failure Cases
- `401` invalid webhook secret (when configured)
- `400` invalid status (allowed: `uploaded`, `processed`)
- `404` meeting not found

## Environment Variables

Required:
- `DATABASE_URL`
- `SUPABASE_JWT_SECRET`

Optional:
- `UPLOAD_WEBHOOK_SECRET` (enables shared-secret protection for webhook endpoint)
- `CREATE_TABLES` (development startup behavior)
- `CORS_ORIGINS` (comma-separated list of allowed browser origins)
- `MEDIA_DIR` (filesystem path for uploaded development audio)
- `MEDIA_BASE_URL` (override public base URL for served development audio)
- `DEV_AUTH_USER_ID` (local-only auth fallback for uploads and meeting fetches)
- `DEV_AUTH_EMAIL` (optional email attached to the local dev auth payload)

## Review Notes for Collaborators

1. **Schema compatibility check**
   - The `Meeting` model now expects UUID string IDs and additional columns (`user_id`, `audio_url`, `duration_seconds`, `status`, `title`, `created_at`).
   - If your DB was created with an older schema, add/apply a migration before testing writes.

2. **Security review**
   - Confirm JWT secret source is correct for your Supabase project.
   - For production webhook usage, set `UPLOAD_WEBHOOK_SECRET` and rotate it through your secret manager.

3. **Integration review**
  - Frontend clients should send Supabase JWT in `Authorization` header, unless intentionally using the local dev fallback.
   - Upload pipeline should call webhook endpoint once upload/processing state changes.

## Suggested Next Tasks

- Add Alembic migration for the updated `meetings` table shape.
- Add endpoint tests (auth failure, create success, owner checks, webhook secret validation).
- Consider status enum + stricter webhook signature scheme (HMAC) if this endpoint will be public-facing.
