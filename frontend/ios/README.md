# iOS Frontend

SwiftUI iOS app for Meeting Notes AI.

## Setup

1. Open in Xcode
2. Build and run on simulator/device
3. Add `NSMicrophoneUsageDescription` to the app target's `Info.plist` before testing on device or simulator.
4. Use a bearer token, or set `DEV_AUTH_USER_ID` on the backend for local upload testing.

## Features

- Audio recording with AVFoundation
- Meeting lifecycle flow using `POST /meetings/start`, `POST /meetings/{id}/upload-audio`, and `POST /meetings/{id}/finalize`
- Display of the latest meeting creation response