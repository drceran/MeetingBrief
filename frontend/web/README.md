# Web Frontend

React + TypeScript web app for Meeting Notes AI.

## Setup

1. Install dependencies: `npm install`
2. Start development server: `npm start`
3. Point the UI at your backend URL. The local backend can run with authentication disabled for development.

## Features

- Browser-based audio recording with `MediaRecorder`
- Client-driven meeting lifecycle using `POST /meetings/start`, `POST /meetings/{id}/upload-audio`, and `POST /meetings/{id}/finalize`
- Transcript and summary editing against the local backend
- Action item creation, completion toggling, and deletion
- Local preview of the recorded clip and the created meeting response