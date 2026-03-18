Setup and connect backend to a Postgres (e.g. Supabase) database

1) Create a Supabase project (or other Postgres instance) and get the connection string.

2) Populate environment variables. Copy `.env.example` to `.env` and update `DATABASE_URL`.

3) (Optional) Create tables locally or in your hosted DB:

```bash
source .venv/bin/activate
pip install -r requirements.txt
python -m backend.create_tables
```

4) Run the app locally:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

5) Deployment notes:
- You can deploy this FastAPI app to a host that supports Python/Docker (Railway, Fly, Heroku, etc.).
- Supabase provides a Postgres database; the backend should be deployed separately (Supabase edge functions are JS/TS-only).
# Backend

FastAPI backend for Meeting Notes AI.

## Setup

1. Install dependencies: `pip install -r requirements.txt`
2. Run: `uvicorn main:app --reload`

## Local Database (Docker)

1. Start Postgres:

```bash
cd backend
docker compose up -d
```

2. Initialize tables:

```bash
cd ..
python -m backend.create_tables
```

3. Verify tables:

```bash
cd backend
docker exec -i meetingbrief-postgres psql -U postgres -d meetingbrief -c "\\dt"
```

## Run with Python

You can also run the app directly with Python (this uses the embedded `uvicorn` runner):

```bash
# default port 8000
python3 main.py

# set a different port
PORT=5000 python3 main.py
```

## Features

- Local app user registration and login with JWT sessions
- Optional Supabase JWT compatibility for existing integrations
- Meeting recording upload
- Stored meetings, transcripts, summaries, and action items per user

## Core Tables

- `users`
- `meetings`
- `meeting_transcripts`
- `meeting_summaries`
- `action_items`

## Local development helpers

- Set `AUTH_DISABLED=true` to bypass JWT verification entirely and use a local developer user for all auth-protected routes.
- Set `AUTH_DISABLED=false` when testing the new local register/login flow.
- Set `DEV_AUTH_USER_ID` to allow owner-scoped meeting endpoints and uploads without a bearer token during local development.
- Set `APP_JWT_SECRET` to override the default local JWT signing secret.
- Set `CORS_ORIGINS` to a comma-separated list of allowed web origins when testing browser uploads.
- Uploaded audio files are stored under `backend/media/` by default and served from `/media/...` locally.

## API Endpoints

- `POST /auth/register` — create a local user account and return an access token.
- `POST /auth/login` — authenticate a local user and return an access token.
- `GET /auth/me` — return the authenticated user profile.
- `GET /auth/verify` — verify the current bearer token and return the authenticated user summary.
- `GET /meetings/` — list all meetings owned by the current user.
- `POST /meetings/start` — create an empty meeting record and begin the client-driven lifecycle.
- `POST /meetings/` — create a meeting record for the authenticated user.
- `POST /meetings/{meeting_id}/upload-audio` — attach uploaded audio to an existing meeting.
- `POST /meetings/{meeting_id}/finalize` — mark an uploaded meeting as finalized.
- `POST /meetings/upload` — upload audio directly as multipart form data and create a meeting record.
- `GET /meetings/{meeting_id}` — fetch one meeting (owner-only).
- `GET /meetings/{meeting_id}/transcript` — fetch the stored transcript for a meeting.
- `PUT /meetings/{meeting_id}/transcript` — create or replace the transcript for a meeting.
- `GET /meetings/{meeting_id}/summary` — fetch the stored summary for a meeting.
- `PUT /meetings/{meeting_id}/summary` — create or replace the summary for a meeting.
- `GET /meetings/{meeting_id}/action-items` — list all action items for a meeting.
- `POST /meetings/{meeting_id}/action-items` — create a new action item for a meeting.
- `PATCH /meetings/{meeting_id}/action-items/{action_item_id}` — update an existing action item.
- `DELETE /meetings/{meeting_id}/action-items/{action_item_id}` — delete an action item.
- `POST /meetings/upload/webhook` — update meeting upload metadata/status (optional `X-Webhook-Secret`).