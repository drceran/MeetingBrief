# Meeting Recorder & AI Summarizer

## Design Document (MVP → v1)

---
## Preferences:
Think like a 10x engineer. Seek for simplicity and easy to read and debug while writing the code. Think about all the different parts that the newly introduced code might effect and suggest  changes in those as well, or 


## 1. Overview

**Product name (working):** Meeting Notes AI  
**Platforms:** iOS (App Store) + Web  
**Business model:** Freemium + In-App Purchases  
**Target users:**
- Professors & students
- Lawyers & clients
- Teachers & parents
- Doctors & patients

**Core value proposition:**
Record meetings, automatically generate summaries and actionable items, and provide *explainable AI* by linking each summary/action item to the exact transcript and audio reference.

---

## 2. Goals & Non‑Goals

### Goals
- Zero-cost infrastructure for MVP
- One backend supporting iOS + Web
- Apple App Store compliant
- Explainable summaries with transcript references
- Simple, seamless deployment

### Non‑Goals (MVP)
- Real-time transcription
- Multi-user meetings
- Organization accounts
- HIPAA certification (future)

---

## 3. High-Level Architecture

```
[iOS App]        [Web App]
   |                 |
   |  OAuth + Audio  |
   v                 v
        Supabase Auth
               |
        FastAPI Backend
               |
   ----------------------------------
   |             |                  |
Supabase DB  Supabase Storage   LLM APIs
(Postgres)   (Audio Files)     (Summarize)
```

---

## 4. Technology Stack

### Frontend
- **iOS:** SwiftUI, AVAudioEngine
- **Web:** React + TypeScript (Vercel)

### Backend
- **Framework:** FastAPI (Python)
- **Async jobs:** FastAPI BackgroundTasks (MVP)

### Data & Infra
- **Auth:** Supabase Auth (Apple + Google)
- **Database:** Supabase Postgres
- **Storage:** Supabase Storage
- **Email:** Resend / Supabase SMTP

### AI
- **Transcription:** Whisper / Deepgram
- **Summarization:** LLM (OpenAI / Anthropic)
- **Context Protocol:** MCP-style structured prompts

---

## 5. Authentication Flow

1. User signs in via Apple or Google
2. Supabase issues JWT
3. Client sends JWT to backend
4. Backend verifies JWT via Supabase
5. Backend issues session access

**No passwords stored.**

---

## 6. Recording & Upload Flow

1. User checks remaining minutes
2. Client records audio (max limit enforced)
3. Audio uploaded to Supabase Storage
4. Backend creates meeting record
5. Background job starts transcription

---

## 7. Usage Limiting (Freemium)

### Free Tier
- 30 minutes / month
- Hard limit enforced server-side

### Enforcement
- Client check (UX)
- Backend authoritative validation

```python
if used_minutes + audio_minutes > FREE_LIMIT:
    raise HTTPException(403)
```

---

## 8. Database Schema (Core)

### users
- id (uuid)
- email
- created_at

### meetings
- id (uuid)
- user_id
- duration_seconds
- status (uploaded | processed)
- created_at

### transcripts
- id
- meeting_id
- text
- start_time
- end_time
- speaker

### summaries
- meeting_id
- summary_text (jsonb)

### action_items
- id
- meeting_id
- text
- owner
- due_date
- reference_segments (int[])

### usage_stats
- user_id
- free_minutes_used
- plan
- reset_at

---

## 9. MCP‑Style LLM Prompt Design

### Input Context
- Transcript segments
- Speaker info
- User role (optional)

### Output (JSON)
```json
{
  "summary": "...",
  "action_items": [
    {
      "text": "Submit grades by Friday",
      "references": [12, 13]
    }
  ]
}
```

---

## 10. Explainability UX

- Hover / tap action item
- Fetch referenced transcript rows
- Highlight text + optional audio playback

This is a key differentiator.

---

## 11. Email Sharing

- User reviews summary
- Enters recipient email
- Backend sends formatted email
- Logs delivery

---

## 12. Deployment Strategy

### Web
- Vercel (free)

### Backend
- Fly.io (free tier)

### Supabase
- Single project for Auth, DB, Storage

---

## 13. Security & Privacy

- TLS everywhere
- Per-user storage isolation
- Explicit recording consent
- Data deletion available
- Audio auto-delete (7 days, free tier)

---

## 14. App Store Compliance

- Privacy policy required
- Disclosure of AI usage
- In-App Purchase only for iOS upgrades
- No external payment unlocks

---

## 15. Future Enhancements

- Organization accounts
- Live transcription
- Multi-speaker diarization
- Export to Notion / Docs
- On-device transcription

---

## 16. Success Metrics

- % meetings completed
- Avg minutes per user
- Free → Pro conversion
- Summary accuracy feedback

---

## 17. Risks & Mitigations

| Risk | Mitigation |
|----|----|
| LLM cost | Hard limits |
| Abuse | Rate limiting |
| App Store rejection | Clear consent UX |
| Data privacy | Supabase RLS |

---

## 18. MVP Checklist

- [ ] Auth working
- [ ] Recording + upload
- [ ] Transcription
- [ ] Summary + action items
- [ ] Usage limits
- [ ] Email sharing
- [ ] App Store submission

---

✅ Auth working

Users can:

Sign in with Apple

Sign in with Google

Stay logged in

Log out

❌ No profiles, avatars, orgs yet

✅ Recording + upload

Users can:

Start recording

Stop recording

Upload audio successfully

❌ No pause/resume, no background magic yet

✅ Transcription

Backend can:

Convert audio → text

Store timestamps

Handle failures gracefully

❌ No live transcription

✅ Summary + action items

LLM can:

Generate a readable summary

Extract action items

Return structured data

❌ No advanced customization yet

✅ Usage limits

Free users:

Have a minute cap

Are blocked when exceeded

See an upgrade prompt

❌ No complex plans or discounts yet

✅ Email sharing

Users can:

Review output

Send summary to an email address

❌ No templates, no CC/BCC yet

✅ App Store submission

You have:

Privacy policy

Recording consent screen

IAP configured

App Store metadata filled

❌ No marketing site needed yet
