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

- Authentication via Supabase
- Meeting recording upload
- Background transcription and summarization

## Local development helpers

- Set `DEV_AUTH_USER_ID` to allow owner-scoped meeting endpoints and uploads without a bearer token during local development.
- Set `CORS_ORIGINS` to a comma-separated list of allowed web origins when testing browser uploads.
- Uploaded audio files are stored under `backend/media/` by default and served from `/media/...` locally.

## API Endpoints

- `GET /auth/verify` — verify Supabase JWT and return authenticated user summary.
- `POST /meetings/` — create a meeting record for the authenticated user.
- `POST /meetings/upload` — upload audio directly as multipart form data and create a meeting record.
- `GET /meetings/{meeting_id}` — fetch one meeting (owner-only).
- `POST /meetings/upload/webhook` — update meeting upload metadata/status (optional `X-Webhook-Secret`).