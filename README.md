# Meeting Recorder & AI Summarizer

This is a greenfield project for an AI-powered meeting recorder and summarizer.

## Architecture

- **Frontend**: iOS (SwiftUI, AVAudioEngine), Web (React + TypeScript on Vercel)
- **Backend**: FastAPI (Python) with BackgroundTasks
- **Data & Infra**: Supabase Auth, Postgres, Storage, Email
- **AI**: Transcription (Whisper/Deepgram), Summarization (OpenAI/Anthropic), MCP-style prompts

## Project Structure

- `backend/`: FastAPI backend
- `frontend/`: Frontend applications
  - `ios/`: iOS SwiftUI app
  - `web/`: React web app
- `ai/`: AI processing scripts
- `docs/`: Documentation

## Getting Started

See individual directories for setup instructions.