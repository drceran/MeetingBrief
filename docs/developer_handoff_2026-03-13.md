# Developer Handoff (March 13, 2026)

This note summarizes the current working state of the MeetingBrief repo after the web recorder, backend lifecycle API, and SwiftUI iOS client wiring work.

## What Was Implemented

### Backend
- Added lifecycle endpoints for meetings:
  - `POST /meetings/start`
  - `POST /meetings/{meeting_id}/upload-audio`
  - `POST /meetings/{meeting_id}/finalize`
  - `GET /meetings/{meeting_id}` remains available
- Kept the legacy one-shot upload route:
  - `POST /meetings/upload`
- Added local media storage and serving from `/media/...`
- Added local development auth fallback via `DEV_AUTH_USER_ID` and `DEV_AUTH_EMAIL`
- Added CORS support for local web testing

### Web Client
- Replaced placeholder UI with a working React recorder/upload flow
- Current flow is:
  1. create meeting via `POST /meetings/start`
  2. upload audio via `POST /meetings/{id}/upload-audio`
  3. finalize via `POST /meetings/{id}/finalize`
- Web app is the most ready-to-test client in-repo

### iOS Client
- Replaced placeholder SwiftUI content with a local recorder/upload screen
- Uses `AVAudioRecorder` for capture and `URLSession` for lifecycle API calls
- Adjusted code for current Xcode/Swift 6 issues encountered during local setup:
  - only one `@main` app entry should exist in the Xcode project
  - added `Combine` import for `ObservableObject`/`@Published`
  - removed `AVAudioRecorderDelegate` callback path to avoid actor-isolation issues
  - switched microphone permission request to the iOS 17 API with fallback
  - replaced closure-based timer with selector-based timer to avoid Swift 6 Sendable warnings

## Current Status

### Verified
- Backend lifecycle routes import correctly
- Local `POST /meetings/start` responds successfully against the running backend
- Web code was updated to the lifecycle flow
- iOS `ContentView.swift` was iteratively cleaned up for Swift 6/Xcode compatibility

### Not Fully Verified Yet
- Full end-to-end iOS simulator/device run was not completed inside this repo because the repo does not include an `.xcodeproj`
- The user created the Xcode project separately and reached a successful build after fixing multiple Swift 6 issues, but runtime recording/upload still needs final manual testing in Xcode

## Local Run Notes

### Backend
- Start local Postgres with:

```bash
docker compose -f backend/docker-compose.yml up -d
```

- Run the API from the backend environment.
- Local development currently supports requests without a bearer token when `DEV_AUTH_USER_ID` is configured.

### Web
- Run from `frontend/web`

```bash
npm install
npm start
```

- Default backend URL in the UI is `http://localhost:8000`

### iOS
- Create an Xcode iOS App project using `SwiftUI` + `Swift`
- Keep the generated `MeetingBriefApp.swift` as the only `@main` file
- Copy the recorder UI/view-model code into `ContentView.swift`
- Add `Privacy - Microphone Usage Description` in the target settings
- Use `http://localhost:8000` in the simulator; use the Mac's LAN IP for a physical device

## Important Files

### Backend
- `backend/main.py`
- `backend/auth.py`
- `backend/routers/meetings.py`
- `backend/models.py`
- `backend/.env`

### Frontend
- `frontend/web/src/App.tsx`
- `frontend/web/src/App.css`
- `frontend/ios/ContentView.swift`

### Docs
- `docs/backend_endpoint_changes_2026-03-11.md`
- `docs/developer_handoff_2026-03-13.md`

## Collaboration Notes

- The backend supports both the old one-shot upload route and the newer lifecycle flow.
- The repo does not contain a committed Xcode project yet; collaboration on iOS will be easier once the `.xcodeproj` and target settings are added to source control.
- If iOS work continues, the next high-value step is a real simulator/device validation of recording, upload, and finalize against the local backend.
- If the team wants cleaner local onboarding, the next backend cleanup step is to make `.env.example` authoritative and consider a single command path for API + DB startup.