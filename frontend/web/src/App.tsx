import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading';

type UploadResult = {
  id: string;
  user_id: string;
  status: string;
  audio_url: string | null;
  duration_seconds: number;
  title: string | null;
  created_at: string | null;
};

const DEFAULT_API_BASE = 'http://localhost:8000';

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function App() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);

  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE);
  const [authToken, setAuthToken] = useState('');
  const [title, setTitle] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Ready to record.');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const mimeType = useMemo(() => getSupportedMimeType(), []);
  const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!mimeType;

  useEffect(() => {
    if (recordingState !== 'recording') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (startedAtRef.current === null) {
        return;
      }
      const nextElapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      setElapsedSeconds(nextElapsed);
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [recordingState]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    setErrorMessage('');
    setUploadResult(null);

    if (!canRecord) {
      setErrorMessage('This browser does not support microphone recording with MediaRecorder.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType });

      chunksRef.current = [];
      recorderRef.current = recorder;
      streamRef.current = stream;
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      setAudioBlob(null);
      setStatusMessage('Recording in progress.');
      setRecordingState('recording');

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setRecordingState('stopped');
        setStatusMessage('Recording captured and ready to upload.');
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Microphone access failed.';
      setErrorMessage(message);
      setStatusMessage('Unable to access the microphone.');
      setRecordingState('idle');
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }

  async function uploadRecording() {
    if (!audioBlob) {
      setErrorMessage('Record audio before uploading.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('Uploading recording...');
    setRecordingState('uploading');

    const durationSeconds = Math.max(elapsedSeconds, 1);
    const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
    const formData = new FormData();
    formData.append('audio', audioBlob, `meeting-recording.${extension}`);
    formData.append('duration_seconds', String(durationSeconds));
    if (title.trim()) {
      formData.append('title', title.trim());
    }

    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/meetings/upload`, {
        method: 'POST',
        headers: authToken.trim()
          ? {
              Authorization: `Bearer ${authToken.trim()}`,
            }
          : undefined,
        body: formData,
      });

      if (!response.ok) {
        const fallbackMessage = `Upload failed with status ${response.status}.`;
        let detail = fallbackMessage;

        try {
          const data = (await response.json()) as { detail?: string };
          detail = data.detail || fallbackMessage;
        } catch {
          detail = fallbackMessage;
        }

        throw new Error(detail);
      }

      const data = (await response.json()) as UploadResult;
      setUploadResult(data);
      setStatusMessage('Upload complete. Meeting created successfully.');
      setRecordingState('stopped');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      setErrorMessage(message);
      setStatusMessage('Upload failed.');
      setRecordingState('stopped');
    }
  }

  function resetRecording() {
    setAudioBlob(null);
    setElapsedSeconds(0);
    setUploadResult(null);
    setErrorMessage('');
    setStatusMessage('Ready to record.');
    setRecordingState('idle');
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">MeetingBrief Local Recorder</p>
        <h1>Record locally, upload directly, verify the backend contract.</h1>
        <p className="hero-copy">
          This screen is wired to the new multipart upload endpoint. Supply a bearer token, or leave it
          blank when local development uses <code>DEV_AUTH_USER_ID</code> on the backend.
        </p>
      </section>

      <section className="control-grid">
        <div className="panel">
          <label className="field-label" htmlFor="apiBaseUrl">Backend URL</label>
          <input
            id="apiBaseUrl"
            className="text-input"
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            placeholder="http://localhost:8000"
          />

          <label className="field-label" htmlFor="authToken">Bearer token</label>
          <textarea
            id="authToken"
            className="text-area"
            value={authToken}
            onChange={(event) => setAuthToken(event.target.value)}
            placeholder="Optional when DEV_AUTH_USER_ID is configured on the backend"
            rows={4}
          />

          <label className="field-label" htmlFor="meetingTitle">Meeting title</label>
          <input
            id="meetingTitle"
            className="text-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Weekly standup"
          />
        </div>

        <div className="panel recorder-panel">
          <div className="status-row">
            <span className="status-pill status-pill--active">{recordingState}</span>
            <span className="timer">{elapsedSeconds}s</span>
          </div>

          <p className="status-copy">{statusMessage}</p>

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              onClick={startRecording}
              disabled={recordingState === 'recording' || recordingState === 'uploading' || !canRecord}
            >
              Start Recording
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={stopRecording}
              disabled={recordingState !== 'recording'}
            >
              Stop
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={uploadRecording}
              disabled={!audioBlob || recordingState === 'uploading'}
            >
              Upload
            </button>
            <button className="ghost-button" type="button" onClick={resetRecording}>
              Reset
            </button>
          </div>

          {!canRecord ? (
            <p className="support-note">
              MediaRecorder support was not detected in this browser. Use a recent desktop browser for
              local verification.
            </p>
          ) : null}

          {audioBlob ? (
            <div className="preview-panel">
              <p className="preview-label">Playback preview</p>
              <audio controls src={URL.createObjectURL(audioBlob)} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel response-panel">
        <h2>Last upload</h2>
        {uploadResult ? (
          <dl className="result-grid">
            <div>
              <dt>Meeting ID</dt>
              <dd>{uploadResult.id}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{uploadResult.status}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{uploadResult.duration_seconds}s</dd>
            </div>
            <div>
              <dt>Audio URL</dt>
              <dd>{uploadResult.audio_url ?? 'n/a'}</dd>
            </div>
          </dl>
        ) : (
          <p className="empty-copy">No upload completed yet.</p>
        )}
      </section>
    </main>
  );
}

export default App;