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

type TranscriptResult = {
  id: number;
  meeting_id: string;
  transcript_text: string;
  provider: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SummaryResult = {
  id: number;
  meeting_id: string;
  summary_text: string;
  provider: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ActionItem = {
  id: number;
  meeting_id: string;
  description: string;
  owner_name: string | null;
  due_at: string | null;
  completed: boolean;
  created_at: string | null;
  updated_at: string | null;
};

const DEFAULT_API_BASE = 'http://localhost:8000';

async function getErrorMessage(response: Response): Promise<string> {
  const fallbackMessage = `Request failed with status ${response.status}.`;

  try {
    const data = (await response.json()) as { detail?: string };
    return data.detail || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

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
  const [title, setTitle] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Ready to record.');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptProvider, setTranscriptProvider] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [summaryProvider, setSummaryProvider] = useState('');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newActionItemDescription, setNewActionItemDescription] = useState('');
  const [newActionItemOwner, setNewActionItemOwner] = useState('');
  const [newActionItemDueAt, setNewActionItemDueAt] = useState('');
  const [artifactsMessage, setArtifactsMessage] = useState('No transcript, summary, or action items saved yet.');
  const [artifactsError, setArtifactsError] = useState('');
  const [isSavingArtifacts, setIsSavingArtifacts] = useState(false);

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

  async function fetchOptionalJson<T>(url: string): Promise<T | null> {
    const response = await fetch(url);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    return (await response.json()) as T;
  }

  async function refreshArtifacts(meetingId: string) {
    const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
    const [transcript, summary, items] = await Promise.all([
      fetchOptionalJson<TranscriptResult>(`${normalizedApiBase}/meetings/${meetingId}/transcript`),
      fetchOptionalJson<SummaryResult>(`${normalizedApiBase}/meetings/${meetingId}/summary`),
      fetch(`${normalizedApiBase}/meetings/${meetingId}/action-items`).then(async (response) => {
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }
        return (await response.json()) as ActionItem[];
      }),
    ]);

    setTranscriptText(transcript?.transcript_text ?? '');
    setTranscriptProvider(transcript?.provider ?? '');
    setSummaryText(summary?.summary_text ?? '');
    setSummaryProvider(summary?.provider ?? '');
    setActionItems(items);
    setArtifactsMessage(
      transcript || summary || items.length
        ? 'Meeting artifacts synced from the backend.'
        : 'No transcript, summary, or action items saved yet.'
    );
    setArtifactsError('');
  }

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
    const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
    const formData = new FormData();
    formData.append('audio', audioBlob, `meeting-recording.${extension}`);
    formData.append('duration_seconds', String(durationSeconds));
    if (title.trim()) {
      formData.append('title', title.trim());
    }

    try {
      setStatusMessage('Creating meeting...');
      const startResponse = await fetch(`${normalizedApiBase}/meetings/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim() || null,
        }),
      });

      if (!startResponse.ok) {
        throw new Error(await getErrorMessage(startResponse));
      }

      const startedMeeting = (await startResponse.json()) as UploadResult;

      setStatusMessage('Uploading recording...');
      const uploadResponse = await fetch(`${normalizedApiBase}/meetings/${startedMeeting.id}/upload-audio`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(await getErrorMessage(uploadResponse));
      }

      setStatusMessage('Finalizing meeting...');
      const finalizeResponse = await fetch(`${normalizedApiBase}/meetings/${startedMeeting.id}/finalize`, {
        method: 'POST',
      });

      if (!finalizeResponse.ok) {
        throw new Error(await getErrorMessage(finalizeResponse));
      }

      const data = (await finalizeResponse.json()) as UploadResult;
      setUploadResult(data);
      await refreshArtifacts(data.id);
      setStatusMessage('Upload complete. Meeting created and finalized successfully.');
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
    setTranscriptText('');
    setTranscriptProvider('');
    setSummaryText('');
    setSummaryProvider('');
    setActionItems([]);
    setNewActionItemDescription('');
    setNewActionItemOwner('');
    setNewActionItemDueAt('');
    setArtifactsMessage('No transcript, summary, or action items saved yet.');
    setArtifactsError('');
    setStatusMessage('Ready to record.');
    setRecordingState('idle');
  }

  async function saveTranscript() {
    if (!uploadResult) {
      return;
    }

    setIsSavingArtifacts(true);
    setArtifactsError('');

    try {
      const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
      const response = await fetch(`${normalizedApiBase}/meetings/${uploadResult.id}/transcript`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript_text: transcriptText,
          provider: transcriptProvider.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await refreshArtifacts(uploadResult.id);
      setArtifactsMessage('Transcript saved.');
    } catch (error) {
      setArtifactsError(error instanceof Error ? error.message : 'Failed to save transcript.');
    } finally {
      setIsSavingArtifacts(false);
    }
  }

  async function saveSummary() {
    if (!uploadResult) {
      return;
    }

    setIsSavingArtifacts(true);
    setArtifactsError('');

    try {
      const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
      const response = await fetch(`${normalizedApiBase}/meetings/${uploadResult.id}/summary`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary_text: summaryText,
          provider: summaryProvider.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await refreshArtifacts(uploadResult.id);
      setArtifactsMessage('Summary saved.');
    } catch (error) {
      setArtifactsError(error instanceof Error ? error.message : 'Failed to save summary.');
    } finally {
      setIsSavingArtifacts(false);
    }
  }

  async function addActionItem() {
    if (!uploadResult || !newActionItemDescription.trim()) {
      return;
    }

    setIsSavingArtifacts(true);
    setArtifactsError('');

    try {
      const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
      const response = await fetch(`${normalizedApiBase}/meetings/${uploadResult.id}/action-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: newActionItemDescription.trim(),
          owner_name: newActionItemOwner.trim() || null,
          due_at: newActionItemDueAt ? new Date(newActionItemDueAt).toISOString() : null,
          completed: false,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setNewActionItemDescription('');
      setNewActionItemOwner('');
      setNewActionItemDueAt('');
      await refreshArtifacts(uploadResult.id);
      setArtifactsMessage('Action item added.');
    } catch (error) {
      setArtifactsError(error instanceof Error ? error.message : 'Failed to add action item.');
    } finally {
      setIsSavingArtifacts(false);
    }
  }

  async function updateActionItem(item: ActionItem, patch: Partial<ActionItem>) {
    if (!uploadResult) {
      return;
    }

    setIsSavingArtifacts(true);
    setArtifactsError('');

    try {
      const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
      const response = await fetch(`${normalizedApiBase}/meetings/${uploadResult.id}/action-items/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await refreshArtifacts(uploadResult.id);
      setArtifactsMessage('Action item updated.');
    } catch (error) {
      setArtifactsError(error instanceof Error ? error.message : 'Failed to update action item.');
    } finally {
      setIsSavingArtifacts(false);
    }
  }

  async function deleteActionItem(itemId: number) {
    if (!uploadResult) {
      return;
    }

    setIsSavingArtifacts(true);
    setArtifactsError('');

    try {
      const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
      const response = await fetch(`${normalizedApiBase}/meetings/${uploadResult.id}/action-items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await refreshArtifacts(uploadResult.id);
      setArtifactsMessage('Action item deleted.');
    } catch (error) {
      setArtifactsError(error instanceof Error ? error.message : 'Failed to delete action item.');
    } finally {
      setIsSavingArtifacts(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">MeetingBrief Local Recorder</p>
        <h1>Record locally, upload directly, verify the backend contract.</h1>
        <p className="hero-copy">
          This screen is wired to the meeting lifecycle flow: start, upload audio, then finalize. It is
          configured for local backend testing without authentication.
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

      <section className="panel artifacts-panel">
        <div className="artifacts-header">
          <div>
            <p className="eyebrow">Artifacts</p>
            <h2>Transcript, summary, and action items</h2>
          </div>
          {uploadResult ? <span className="status-pill">Meeting ready</span> : null}
        </div>

        {!uploadResult ? (
          <p className="empty-copy">Upload a meeting first to manage transcript, summary, and action items.</p>
        ) : (
          <div className="artifact-grid">
            <div className="artifact-card">
              <h3>Transcript</h3>
              <label className="field-label" htmlFor="transcriptProvider">Provider</label>
              <input
                id="transcriptProvider"
                className="text-input"
                value={transcriptProvider}
                onChange={(event) => setTranscriptProvider(event.target.value)}
                placeholder="OpenAI, Anthropic, manual"
              />
              <label className="field-label" htmlFor="transcriptText">Transcript text</label>
              <textarea
                id="transcriptText"
                className="text-area artifact-textarea"
                value={transcriptText}
                onChange={(event) => setTranscriptText(event.target.value)}
                placeholder="Paste or edit the transcript here"
                rows={8}
              />
              <button className="primary-button" type="button" onClick={saveTranscript} disabled={isSavingArtifacts || !transcriptText.trim()}>
                Save Transcript
              </button>
            </div>

            <div className="artifact-card">
              <h3>Summary</h3>
              <label className="field-label" htmlFor="summaryProvider">Provider</label>
              <input
                id="summaryProvider"
                className="text-input"
                value={summaryProvider}
                onChange={(event) => setSummaryProvider(event.target.value)}
                placeholder="OpenAI, Anthropic, manual"
              />
              <label className="field-label" htmlFor="summaryText">Summary text</label>
              <textarea
                id="summaryText"
                className="text-area artifact-textarea"
                value={summaryText}
                onChange={(event) => setSummaryText(event.target.value)}
                placeholder="Write the meeting summary here"
                rows={8}
              />
              <button className="primary-button" type="button" onClick={saveSummary} disabled={isSavingArtifacts || !summaryText.trim()}>
                Save Summary
              </button>
            </div>

            <div className="artifact-card artifact-card--wide">
              <h3>Action items</h3>
              <div className="action-item-form">
                <input
                  className="text-input"
                  value={newActionItemDescription}
                  onChange={(event) => setNewActionItemDescription(event.target.value)}
                  placeholder="Action item description"
                />
                <input
                  className="text-input"
                  value={newActionItemOwner}
                  onChange={(event) => setNewActionItemOwner(event.target.value)}
                  placeholder="Owner"
                />
                <input
                  className="text-input"
                  type="datetime-local"
                  value={newActionItemDueAt}
                  onChange={(event) => setNewActionItemDueAt(event.target.value)}
                />
                <button className="primary-button" type="button" onClick={addActionItem} disabled={isSavingArtifacts || !newActionItemDescription.trim()}>
                  Add Action Item
                </button>
              </div>

              {actionItems.length ? (
                <div className="action-item-list">
                  {actionItems.map((item) => (
                    <div className="action-item-row" key={item.id}>
                      <div>
                        <p className={`action-item-title${item.completed ? ' action-item-title--done' : ''}`}>{item.description}</p>
                        <p className="action-item-meta">
                          {item.owner_name || 'Unassigned'}
                          {item.due_at ? ` • Due ${new Date(item.due_at).toLocaleString()}` : ''}
                        </p>
                      </div>
                      <div className="action-item-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => updateActionItem(item, { completed: !item.completed })}
                          disabled={isSavingArtifacts}
                        >
                          {item.completed ? 'Mark Open' : 'Complete'}
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => deleteActionItem(item.id)}
                          disabled={isSavingArtifacts}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-copy">No action items yet.</p>
              )}
            </div>
          </div>
        )}

        <p className="status-copy">{artifactsMessage}</p>
        {artifactsError ? <p className="error-banner">{artifactsError}</p> : null}
      </section>
    </main>
  );
}

export default App;