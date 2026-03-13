# Backend Endpoint Changes (March 12, 2026)

This document summarizes the current backend API surface for meeting creation, upload, and lifecycle progression.

## Summary

Implemented meeting-related endpoints:
- `POST /meetings/start`
- `POST /meetings/{meeting_id}/upload-audio`
- `POST /meetings/{meeting_id}/finalize`
- `GET /meetings/{meeting_id}`
- `POST /meetings/upload` (backward-compatible direct upload path)
- `POST /meetings/upload/webhook`

Supported meeting statuses:
- `started`
- `uploaded`
- `finalized`
- `processed`

## Route Overview

### `POST /meetings/start`
- Creates an empty meeting for the authenticated user.
- Uses `CurrentOrDevUser`, so local development can omit the bearer token when `DEV_AUTH_USER_ID` is configured.
- Initializes the meeting with:
  - `audio_url = null`
  - `duration_seconds = 0`
  - `status = "started"`
  - optional `title`

### `POST /meetings/{meeting_id}/upload-audio`
- Uploads a multipart audio file for an existing user-owned meeting.
- Stores the audio locally and updates the meeting record.
- Sets:
  - `audio_url`
  - optional `duration_seconds`
  - optional `title`
  - `status = "uploaded"`

### `POST /meetings/{meeting_id}/finalize`
- Finalizes an existing user-owned meeting.
- Requires that the meeting already has uploaded audio.
- Sets `status = "finalized"`.

### `GET /meetings/{meeting_id}`
- Returns one user-owned meeting.
- Response already exposes lifecycle state through the `status` field, along with `audio_url`, `duration_seconds`, `title`, and `created_at`.

### `POST /meetings/upload`
- Preserved for backward compatibility.
- Creates a new meeting and uploads audio in one request.

### `POST /meetings/upload/webhook`
- Updates an existing meeting status and optional upload metadata.
- Allowed statuses: `started`, `uploaded`, `finalized`, `processed`.

## Request/Response Notes

### `POST /meetings/start`
Request body:
```json
{
  "title": "Weekly Standup"
}
```

### `POST /meetings/{meeting_id}/upload-audio`
Request body:
- `multipart/form-data`
- fields:
  - `audio` required
  - `duration_seconds` optional, integer `>= 0`
  - `title` optional

### `POST /meetings/{meeting_id}/finalize`
Request body:
- none

### `GET /meetings/{meeting_id}` response shape
```json
{
  "id": "<meeting-uuid>",
  "user_id": "<user-id>",
  "status": "finalized",
  "audio_url": "http://localhost:8000/media/<file>",
  "duration_seconds": 120,
  "title": "Weekly Standup",
  "created_at": "2026-03-12T..."
}
```

## File Impact

- `backend/routers/meetings.py`
  - Adds lifecycle endpoints and shared owner lookup logic.
- `backend/README.md`
  - Lists the lifecycle endpoints in the public API summary.

## Local Testing Notes

- Browser and local client testing can use `DEV_AUTH_USER_ID` instead of a bearer token for these meeting routes.
- Uploaded audio is stored under `backend/media/` by default and served from `/media/...`.
- The lifecycle routes are additive: the existing `POST /meetings/upload` path still works for the current web UI.
