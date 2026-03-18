# Web Frontend

React + TypeScript web app for Meeting Notes AI.

## Setup

1. Install dependencies: `npm install`
2. Start development server: `npm start`
3. Point the UI at your backend URL.
4. For local user login, run the backend with `AUTH_DISABLED=false` and register an account from the web UI.
5. If you still want the old no-auth local mode, set `AUTH_DISABLED=true` on the backend and the UI will verify into the local developer user automatically.

## Features

- Local user login and registration against the backend auth endpoints
- Browser-based audio recording with `MediaRecorder`
- Live user-scoped meeting loading from `GET /meetings/`
- Client-driven meeting lifecycle using `POST /meetings/start`, `POST /meetings/{id}/upload-audio`, and `POST /meetings/{id}/finalize`
- Transcript and summary editing against the local backend
- Action item creation, completion toggling, and deletion
- Local preview of the recorded clip and the created meeting response