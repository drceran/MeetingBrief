# Changelog

## 2026-03-17

### Added
- Local account registration and login with JWT-backed sessions in the backend auth router.
- User model fields and Alembic migration support for local authentication identifiers, password hashes, and user creation timestamps.
- Authenticated `GET /meetings/` listing so the web app can load user-scoped meetings.
- Interactive meeting detail experience in the web app with Summary, Transcript, and Audio tabs.
- Persistent action-items side panel with live pending counts, checkbox state updates, and seeded demo interactions.
- Export, share, and transcript download actions from the meeting detail page.

### Changed
- Updated the web UI from the earlier recorder-first screen into a fuller product shell with dashboard, meetings, action items, settings, and drill-in meeting details.
- Restyled the overall frontend with an indigo and warm-white palette for a more enterprise productivity look.
- Improved transcript search so matches are highlighted across the full transcript instead of only filtering visible blocks.
- Updated backend and frontend README files to document local auth, user-scoped meetings, and revised development flows.
- Fixed Alembic filename templating to preserve revision slug formatting.

### Notes
- Frontend production build completed successfully with `npm run build`.
- Current changes include backend auth/data model work and frontend interaction/theme updates as one release set.