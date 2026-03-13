# Web Frontend

React + TypeScript web app for Meeting Notes AI.

## Setup

1. Install dependencies: `npm install`
2. Start development server: `npm start`
3. Point the UI at your backend URL and either paste a bearer token or enable `DEV_AUTH_USER_ID` on the backend for local testing.

## Features

- Browser-based audio recording with `MediaRecorder`
- Direct multipart upload to `POST /meetings/upload`
- Local preview of the recorded clip and the created meeting response