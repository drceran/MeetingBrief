# iOS Frontend

SwiftUI iOS app for Meeting Notes AI.

## Setup

1. Open in Xcode
2. Build and run on simulator/device
3. Add `NSMicrophoneUsageDescription` to the app target's `Info.plist` before testing on device or simulator.
4. Point the app at your local backend. The backend can run with authentication disabled for local development.

## Features

- Audio recording with AVFoundation
- Meeting lifecycle flow using `POST /meetings/start`, `POST /meetings/{id}/upload-audio`, and `POST /meetings/{id}/finalize`
- Transcript and summary editing against the local backend
- Action item creation, completion toggling, and deletion
- Display of the latest meeting creation response