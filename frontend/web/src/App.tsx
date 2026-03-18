import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading';
type ActiveView = 'dashboard' | 'meetings' | 'action-items' | 'settings';
type MeetingFeedStatus = 'done' | 'processing' | 'uploaded';
type MeetingsViewMode = 'list' | 'detail';
type MeetingDetailTab = 'summary' | 'transcript' | 'audio';

type MeetingFeedItem = {
  id: string;
  title: string;
  durationMinutes: number;
  participants: number;
  status: MeetingFeedStatus;
  tags: string[];
  dayLabel: string;
  sortAt: string;
  source: 'recorded' | 'uploaded';
  participantInitials: string[];
  extraParticipants: number;
};

type MeetingParticipant = {
  initials: string;
  name: string;
  role: string;
  note?: string;
};

type TranscriptSegment = {
  id: string;
  speakerName: string;
  speakerInitials: string;
  timestampLabel: string;
  text: string;
};

type MeetingAudioMetadata = {
  format: string;
  modelVersion: string;
  language: string;
  fileSizeLabel: string;
};

type MeetingDetailActionItem = {
  id: string;
  title: string;
  assigneeName: string;
  assigneeInitials: string;
  dueLabel: string | null;
  completed: boolean;
  priority: ActionBoardPriority;
  basePriority?: Exclude<ActionBoardPriority, 'done'>;
  isLive: boolean;
  actionItemId?: number;
};

type SeedMeetingDetail = {
  tlDr: string;
  discussionPoints: string[];
  decisions: Array<{ title: string; body: string }>;
  participants: MeetingParticipant[];
  actionItems: MeetingDetailActionItem[];
  transcriptSegments: TranscriptSegment[];
  audioMetadata: MeetingAudioMetadata;
};

type ActionBoardFilter = 'all' | 'pending' | 'done' | 'high' | 'due-today';
type ActionBoardPriority = 'high' | 'medium' | 'low' | 'done';

type ActionBoardItem = {
  id: string;
  title: string;
  sourceMeeting: string;
  priority: ActionBoardPriority;
  dueLabel: string | null;
  completed: boolean;
  assigneeInitials: string;
  isLive: boolean;
  actionItemId?: number;
};

type SettingsSection =
  | 'profile'
  | 'billing'
  | 'transcription'
  | 'summaries'
  | 'notifications'
  | 'integrations'
  | 'api';

type AuthMode = 'login' | 'register';

type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type AuthSession = {
  access_token: string;
  token_type: string;
  user: AuthenticatedUser;
};

type VerifyResponse = {
  authenticated: boolean;
  user: AuthenticatedUser;
};

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
const AUTH_TOKEN_STORAGE_KEY = 'meetingbrief.auth.token';

const SEEDED_MEETINGS: MeetingFeedItem[] = [
  {
    id: 'seed-q1-planning',
    title: 'Q1 Planning Session',
    durationMinutes: 53,
    participants: 5,
    status: 'done',
    tags: ['Planning', 'Strategy'],
    dayLabel: 'YESTERDAY',
    sortAt: '2026-03-16T16:00:00.000Z',
    source: 'recorded',
    participantInitials: ['AJ', 'SK', 'MF', 'LK'],
    extraParticipants: 1,
  },
  {
    id: 'seed-design-review',
    title: 'Design Review - Mobile App',
    durationMinutes: 42,
    participants: 3,
    status: 'processing',
    tags: ['Design', 'Mobile'],
    dayLabel: 'YESTERDAY',
    sortAt: '2026-03-16T13:30:00.000Z',
    source: 'recorded',
    participantInitials: ['AJ', 'LK', 'TB'],
    extraParticipants: 0,
  },
  {
    id: 'seed-investor-update',
    title: 'Investor Update Call',
    durationMinutes: 74,
    participants: 4,
    status: 'done',
    tags: ['Investor', 'Finance'],
    dayLabel: 'FRIDAY',
    sortAt: '2026-03-13T17:00:00.000Z',
    source: 'uploaded',
    participantInitials: ['AJ', 'SK', 'MF'],
    extraParticipants: 1,
  },
  {
    id: 'seed-standup-w11',
    title: 'Team Standup - Week 11',
    durationMinutes: 18,
    participants: 7,
    status: 'done',
    tags: ['Standup'],
    dayLabel: 'THURSDAY',
    sortAt: '2026-03-12T15:00:00.000Z',
    source: 'recorded',
    participantInitials: ['AJ', 'SK'],
    extraParticipants: 5,
  },
  {
    id: 'seed-roadmap-sync',
    title: 'Product Roadmap Sync',
    durationMinutes: 66,
    participants: 4,
    status: 'done',
    tags: ['Product', 'Roadmap'],
    dayLabel: 'WEDNESDAY',
    sortAt: '2026-03-11T16:00:00.000Z',
    source: 'recorded',
    participantInitials: ['AJ', 'LK', 'TB', 'MF'],
    extraParticipants: 0,
  },
  {
    id: 'seed-all-hands',
    title: 'Engineering All-Hands',
    durationMinutes: 52,
    participants: 12,
    status: 'done',
    tags: ['Engineering'],
    dayLabel: 'TUESDAY',
    sortAt: '2026-03-10T18:00:00.000Z',
    source: 'uploaded',
    participantInitials: ['AJ', 'SK'],
    extraParticipants: 10,
  },
  {
    id: 'seed-feedback-session',
    title: 'Customer Feedback Session',
    durationMinutes: 35,
    participants: 3,
    status: 'done',
    tags: ['Customer', 'Research'],
    dayLabel: 'MAR 9',
    sortAt: '2026-03-09T18:00:00.000Z',
    source: 'recorded',
    participantInitials: ['AJ', 'MF', 'TB'],
    extraParticipants: 0,
  },
  {
    id: 'seed-retro',
    title: 'Sprint Retrospective',
    durationMinutes: 29,
    participants: 6,
    status: 'done',
    tags: ['Sprint', 'Engineering'],
    dayLabel: 'MAR 6',
    sortAt: '2026-03-06T19:00:00.000Z',
    source: 'recorded',
    participantInitials: ['AJ', 'SK', 'LK'],
    extraParticipants: 3,
  },
  {
    id: 'seed-sales-pipeline',
    title: 'Sales Pipeline Review',
    durationMinutes: 48,
    participants: 3,
    status: 'uploaded',
    tags: ['Sales'],
    dayLabel: 'MAR 5',
    sortAt: '2026-03-05T19:00:00.000Z',
    source: 'uploaded',
    participantInitials: ['AJ', 'MF', 'TB'],
    extraParticipants: 0,
  },
  {
    id: 'seed-partnership',
    title: 'Partnership Discussion - Acme Corp',
    durationMinutes: 61,
    participants: 2,
    status: 'done',
    tags: ['Partnership'],
    dayLabel: 'MAR 4',
    sortAt: '2026-03-04T17:00:00.000Z',
    source: 'recorded',
    participantInitials: ['AJ', 'SK'],
    extraParticipants: 0,
  },
];

const MEETING_FILTERS: Array<{ value: 'all' | MeetingFeedStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'processing', label: 'Processing' },
  { value: 'uploaded', label: 'Uploaded' },
];

const ACTION_BOARD_FILTERS: Array<{ value: ActionBoardFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'done', label: 'Done' },
  { value: 'high', label: 'High priority' },
  { value: 'due-today', label: 'Due today' },
];

const MEETING_DETAIL_TABS: Array<{ value: MeetingDetailTab; label: string }> = [
  { value: 'summary', label: 'Summary' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'audio', label: 'Audio' },
];

const DEFAULT_MEETING_PARTICIPANTS: MeetingParticipant[] = [
  { initials: 'AJ', name: 'Alex Johnson', role: 'Product Manager', note: 'Organizer' },
  { initials: 'SK', name: 'Sarah Kim', role: 'Engineering Lead' },
  { initials: 'MR', name: 'Marcus Reid', role: 'Head of Sales' },
  { initials: 'LK', name: 'Lena Kovacs', role: 'Design Lead' },
  { initials: 'TB', name: 'Tom Bennett', role: 'Backend Engineer' },
];

const SEEDED_ACTION_ITEMS: ActionBoardItem[] = [
  {
    id: 'task-q1-roadmap',
    title: 'Finalize Q1 product roadmap and share with leadership',
    sourceMeeting: 'Q1 Planning Session',
    priority: 'high',
    dueLabel: 'Due today',
    completed: false,
    assigneeInitials: 'AJ',
    isLive: false,
  },
  {
    id: 'task-mobile-feedback',
    title: 'Review mobile mockups and send feedback to design team',
    sourceMeeting: 'Design Review - Mobile App',
    priority: 'high',
    dueLabel: 'Due today',
    completed: false,
    assigneeInitials: 'LK',
    isLive: false,
  },
  {
    id: 'task-sequoia-followup',
    title: 'Schedule follow-up call with Sequoia investors',
    sourceMeeting: 'Investor Update Call',
    priority: 'high',
    dueLabel: 'This week',
    completed: false,
    assigneeInitials: 'AJ',
    isLive: false,
  },
  {
    id: 'task-acme-proposal',
    title: 'Draft partnership proposal for Acme Corp',
    sourceMeeting: 'Partnership Discussion - Acme Corp',
    priority: 'high',
    dueLabel: null,
    completed: false,
    assigneeInitials: 'AJ',
    isLive: false,
  },
  {
    id: 'task-api-docs',
    title: 'Update API documentation for v2 endpoints',
    sourceMeeting: 'Team Standup - Week 11',
    priority: 'medium',
    dueLabel: 'This week',
    completed: false,
    assigneeInitials: 'SK',
    isLive: false,
  },
  {
    id: 'task-onboarding',
    title: 'Create onboarding checklist for new engineering hires',
    sourceMeeting: 'Onboarding Call - New Hire',
    priority: 'medium',
    dueLabel: 'Next week',
    completed: false,
    assigneeInitials: 'LK',
    isLive: false,
  },
  {
    id: 'task-mobile-metrics',
    title: 'Define success metrics for mobile launch',
    sourceMeeting: 'Product Roadmap Sync',
    priority: 'medium',
    dueLabel: 'Next week',
    completed: false,
    assigneeInitials: 'AJ',
    isLive: false,
  },
  {
    id: 'task-sales-crm',
    title: 'Update Q4 sales pipeline in CRM',
    sourceMeeting: 'Sales Pipeline Review',
    priority: 'medium',
    dueLabel: null,
    completed: false,
    assigneeInitials: 'MR',
    isLive: false,
  },
  {
    id: 'task-share-recording',
    title: 'Share recording link with team members who missed standup',
    sourceMeeting: 'Team Standup - Week 11',
    priority: 'low',
    dueLabel: 'Tomorrow',
    completed: false,
    assigneeInitials: 'SK',
    isLive: false,
  },
  {
    id: 'task-weekly-digest',
    title: 'Send weekly digest to all stakeholders',
    sourceMeeting: 'Team Standup - Week 10',
    priority: 'low',
    dueLabel: 'Tomorrow',
    completed: false,
    assigneeInitials: 'AJ',
    isLive: false,
  },
  {
    id: 'task-offsite',
    title: 'Book venue for Q2 team offsite',
    sourceMeeting: 'Engineering All-Hands',
    priority: 'done',
    dueLabel: null,
    completed: true,
    assigneeInitials: 'TB',
    isLive: false,
  },
  {
    id: 'task-retro-notes',
    title: 'Circulate retrospective notes to the team',
    sourceMeeting: 'Sprint Retrospective',
    priority: 'done',
    dueLabel: null,
    completed: true,
    assigneeInitials: 'SK',
    isLive: false,
  },
  {
    id: 'task-feedback-report',
    title: 'Review customer feedback report with PM team',
    sourceMeeting: 'Customer Feedback Session',
    priority: 'done',
    dueLabel: null,
    completed: true,
    assigneeInitials: 'MR',
    isLive: false,
  },
  {
    id: 'task-investor-slide',
    title: 'Prepare engineering roadmap slide for investors',
    sourceMeeting: 'Investor Update Call',
    priority: 'done',
    dueLabel: null,
    completed: true,
    assigneeInitials: 'AJ',
    isLive: false,
  },
];

async function getErrorMessage(response: Response): Promise<string> {
  const fallbackMessage = `Request failed with status ${response.status}.`;

  try {
    const data = (await response.json()) as { detail?: string };
    return data.detail || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function formatAppError(error: unknown, apiBaseUrl: string, fallbackMessage: string): string {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return `Unable to reach the backend at ${apiBaseUrl}. Start the API server or update the Backend URL.`;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
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

function formatMinutesLabel(totalMinutes: number): string {
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${totalMinutes}m`;
}

function formatDayLabel(value: string | null): string {
  if (!value) {
    return 'TODAY';
  }

  const meetingDate = new Date(value);
  if (Number.isNaN(meetingDate.getTime())) {
    return 'TODAY';
  }

  const today = new Date();
  const midnightToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const midnightMeeting = new Date(meetingDate.getFullYear(), meetingDate.getMonth(), meetingDate.getDate());
  const diffDays = Math.round((midnightToday.getTime() - midnightMeeting.getTime()) / 86400000);

  if (diffDays === 0) {
    return 'TODAY';
  }
  if (diffDays === 1) {
    return 'YESTERDAY';
  }
  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(meetingDate).toUpperCase();
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(meetingDate).toUpperCase();
}

function normalizeMeetingStatus(status: string): MeetingFeedStatus {
  if (status === 'finalized' || status === 'processed') {
    return 'done';
  }
  if (status === 'uploaded') {
    return 'uploaded';
  }
  return 'processing';
}

function getInitials(value: string | null | undefined): string {
  if (!value?.trim()) {
    return 'AJ';
  }

  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'AJ';
}

function formatDueLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diffDays <= 0) {
    return 'Due today';
  }
  if (diffDays === 1) {
    return 'Tomorrow';
  }
  if (diffDays <= 7) {
    return 'This week';
  }

  return 'Next week';
}

function formatMeetingDateLabel(value: string | null): string {
  const meetingDate = value ? new Date(value) : new Date('2026-03-16T15:00:00.000Z');
  if (Number.isNaN(meetingDate.getTime())) {
    return 'Mon, Mar 16 2026';
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(meetingDate);
}

function formatMeetingTimeLabel(value: string | null): string {
  const meetingDate = value ? new Date(value) : new Date('2026-03-16T15:00:00.000Z');
  if (Number.isNaN(meetingDate.getTime())) {
    return '3:00 PM';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(meetingDate);
}

function formatTimestampLabel(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatAudioTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildTranscriptSegmentsFromParagraphs(
  paragraphs: string[],
  participants: MeetingParticipant[],
): TranscriptSegment[] {
  const fallbackParticipants = participants.length ? participants : DEFAULT_MEETING_PARTICIPANTS;

  return paragraphs.map((paragraph, index) => {
    const speaker = fallbackParticipants[index % fallbackParticipants.length];
    const timestampSeconds = index * 92;

    return {
      id: `generated-${index}`,
      speakerName: speaker.name,
      speakerInitials: speaker.initials,
      timestampLabel: formatTimestampLabel(timestampSeconds),
      text: paragraph,
    };
  });
}

function getDefaultAudioMetadata(meeting: MeetingFeedItem): MeetingAudioMetadata {
  return {
    format: meeting.source === 'uploaded' ? 'MP3' : 'WEBM',
    modelVersion: 'Whisper large-v3',
    language: 'English (US)',
    fileSizeLabel: `${Math.max(8, meeting.durationMinutes * 0.7).toFixed(1)} MB`,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(text: string, query: string): React.ReactNode {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return text;
  }

  const pattern = new RegExp(`(${escapeRegExp(trimmedQuery)})`, 'ig');
  const parts = text.split(pattern);

  return parts.map((part, index) =>
    part.toLowerCase() === trimmedQuery.toLowerCase() ? <mark key={`${part}-${index}`}>{part}</mark> : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>,
  );
}

function countQueryMatches(text: string, query: string): number {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return 0;
  }

  const matches = text.match(new RegExp(escapeRegExp(trimmedQuery), 'ig'));
  return matches?.length ?? 0;
}

function buildSeedMeetingDetail(meeting: MeetingFeedItem): SeedMeetingDetail {
  if (meeting.id === 'seed-q1-planning') {
    return {
      tlDr:
        'The team aligned on Q1 priorities: double down on mobile, delay the API marketplace to Q2, and unblock the design system. Three high-priority actions were assigned, with a follow-up review in two weeks.',
      discussionPoints: [
        'Mobile app velocity is the top Q1 priority. The team agreed to allocate two additional engineers from the API stream to accelerate delivery.',
        'The API marketplace launch is being pushed to Q2 to avoid splitting focus. No customer commitments are affected.',
        'Design system debt is blocking multiple squads. LK will lead a two-week sprint to resolve the most critical inconsistencies.',
        'Q1 success metrics will focus on mobile DAU and NPS with an internal check-in before the next board update.',
        'Investor deck refresh remains a dependency for the April board meeting and needs a first draft this month.',
      ],
      decisions: [
        {
          title: 'Mobile app gets priority staffing',
          body: 'Two engineers moved from the API team to the mobile squad for the remainder of Q1.',
        },
        {
          title: 'API marketplace pushed to Q2',
          body: 'No customer or partner commitments are impacted. The initiative will be revisited in Q2 planning.',
        },
        {
          title: 'Design system sprint approved',
          body: 'A two-week focused sprint starts March 18, led by LK, limited to the top 10 component inconsistencies.',
        },
      ],
      participants: DEFAULT_MEETING_PARTICIPANTS,
      actionItems: [
        {
          id: 'q1-roadmap',
          title: 'Finalize Q1 product roadmap and share with leadership',
          assigneeName: 'Alex Johnson',
          assigneeInitials: 'AJ',
          dueLabel: 'Due today',
          completed: false,
          priority: 'high',
          basePriority: 'high',
          isLive: false,
        },
        {
          id: 'design-audit',
          title: 'Lead design system sprint kickoff',
          assigneeName: 'Lena Kovacs',
          assigneeInitials: 'LK',
          dueLabel: 'March 18',
          completed: false,
          priority: 'medium',
          basePriority: 'medium',
          isLive: false,
        },
        {
          id: 'investor-deck',
          title: 'Draft investor deck first version',
          assigneeName: 'Alex Johnson',
          assigneeInitials: 'AJ',
          dueLabel: 'March 25',
          completed: false,
          priority: 'high',
          basePriority: 'high',
          isLive: false,
        },
        {
          id: 'capacity-review',
          title: 'Review engineering capacity against mobile roadmap',
          assigneeName: 'Sarah Kim',
          assigneeInitials: 'SK',
          dueLabel: null,
          completed: true,
          priority: 'done',
          basePriority: 'medium',
          isLive: false,
        },
        {
          id: 'api-dependencies',
          title: 'Audit marketplace dependencies for investor deck',
          assigneeName: 'Marcus Reid',
          assigneeInitials: 'MR',
          dueLabel: null,
          completed: true,
          priority: 'done',
          basePriority: 'low',
          isLive: false,
        },
      ],
      transcriptSegments: [
        {
          id: 'q1-segment-1',
          speakerName: 'Alex Johnson',
          speakerInitials: 'AJ',
          timestampLabel: '0:00',
          text: `Alright, let's get started. Thanks everyone for joining. Today's goal is to lock our Q1 priorities so we walk out with clear deadlines and no ambiguity about what we're focused on.`,
        },
        {
          id: 'q1-segment-2',
          speakerName: 'Sarah Kim',
          speakerInitials: 'SK',
          timestampLabel: '1:28',
          text: `If we’re going all in on mobile, we should be honest about what has to move. My team can still support that shift, and I think the real gain is the faster iteration loop on the mobile squad.`,
        },
        {
          id: 'q1-segment-3',
          speakerName: 'Alex Johnson',
          speakerInitials: 'AJ',
          timestampLabel: '3:12',
          text: `That’s consistent with what we’ve been hearing from the mobile squad. If we had two more people only focused there, then the team’s biggest risk on the MVP drops meaningfully.`,
        },
        {
          id: 'q1-segment-4',
          speakerName: 'Sarah Kim',
          speakerInitials: 'SK',
          timestampLabel: '5:01',
          text: `We could hit the end-of-March target realistically. The blocker is the design system; we keep reusing components that haven’t matured enough to carry us through these flows.`,
        },
        {
          id: 'q1-segment-5',
          speakerName: 'Lena Kovacs',
          speakerInitials: 'LK',
          timestampLabel: '6:25',
          text: `I can run a two-week design system sprint if we scope it tightly. Just the five components that are actively blocking us. I’d need to de-prioritize the new onboarding flow for two weeks.`,
        },
        {
          id: 'q1-segment-6',
          speakerName: 'Alex Johnson',
          speakerInitials: 'AJ',
          timestampLabel: '8:10',
          text: `Let’s do it. That unlocks the flow we need on mobile in the largest attack right now. Lena, can you kick that off March 18?`,
        },
        {
          id: 'q1-segment-7',
          speakerName: 'Lena Kovacs',
          speakerInitials: 'LK',
          timestampLabel: '9:02',
          text: `Yes, that works. I’ll pull together a scope doc today and share it before EOD.`,
        },
        {
          id: 'q1-segment-8',
          speakerName: 'Marcus Reid',
          speakerInitials: 'MR',
          timestampLabel: '11:47',
          text: `On the sales side, revenue per seat is trending up. Delaying the marketplace launch in enterprise deals this quarter buys us the space to execute aggressively.`,
        },
        {
          id: 'q1-segment-9',
          speakerName: 'Alex Johnson',
          speakerInitials: 'AJ',
          timestampLabel: '14:20',
          text: `We do need to get the investor deck refreshed before the board meeting in April. I’ll own the first draft. Can everyone review it by the 25th?`,
        },
        {
          id: 'q1-segment-10',
          speakerName: 'Sarah Kim',
          speakerInitials: 'SK',
          timestampLabel: '15:48',
          text: `Works for me.`,
        },
        {
          id: 'q1-segment-11',
          speakerName: 'Marcus Reid',
          speakerInitials: 'MR',
          timestampLabel: '16:12',
          text: `Same here. I’ll add the sales pipeline slide.`,
        },
      ],
      audioMetadata: {
        format: 'MP3',
        modelVersion: 'Whisper large-v3',
        language: 'English (US)',
        fileSizeLabel: '18.4 MB',
      },
    };
  }

  const fallbackActions = SEEDED_ACTION_ITEMS.filter((item) => item.sourceMeeting === meeting.title).map((item) => ({
    id: item.id,
    title: item.title,
    assigneeName: item.assigneeInitials,
    assigneeInitials: item.assigneeInitials,
    dueLabel: item.dueLabel,
    completed: item.completed,
    priority: item.priority,
    isLive: false,
  }));

  return {
    tlDr: `${meeting.title} focused on ${meeting.tags.join(', ').toLowerCase()} and closed with a clear set of follow-ups for the team.`,
    discussionPoints: [
      `${meeting.title} reviewed current progress and blockers across the workstream.`,
      `The group aligned on next steps tied to ${meeting.tags[0]?.toLowerCase() ?? 'the current plan'}.`,
      'Owners were assigned for the most urgent follow-ups and timing was clarified before close.',
    ],
    decisions: [
      {
        title: 'Priorities confirmed',
        body: `${meeting.title} closed with agreement on the next milestone and who owns it.`,
      },
      {
        title: 'Follow-up actions assigned',
        body: 'The most important tasks were captured so they can be tracked after the meeting.',
      },
    ],
    participants: DEFAULT_MEETING_PARTICIPANTS.slice(0, Math.max(2, Math.min(5, meeting.participants))),
    actionItems: fallbackActions,
    transcriptSegments: buildTranscriptSegmentsFromParagraphs(
      [
        `${meeting.title} covered current context, open risks, and the next deliverables for the team.`,
        'The team reviewed status, clarified dependencies, and aligned on the timeline for the next checkpoint.',
        'Open questions were captured for follow-up and the meeting ended with explicit ownership for remaining work.',
      ],
      DEFAULT_MEETING_PARTICIPANTS.slice(0, Math.max(2, Math.min(5, meeting.participants))),
    ),
    audioMetadata: getDefaultAudioMetadata(meeting),
  };
}

function derivePriority(item: ActionItem): ActionBoardPriority {
  if (item.completed) {
    return 'done';
  }

  if (item.due_at) {
    const dueDate = new Date(item.due_at);
    const now = new Date();
    const diffDays = Math.round((dueDate.getTime() - now.getTime()) / 86400000);

    if (diffDays <= 1) {
      return 'high';
    }
    if (diffDays <= 7) {
      return 'medium';
    }
  }

  return 'low';
}

function deriveBasePriority(item: ActionItem): Exclude<ActionBoardPriority, 'done'> {
  const nextPriority = derivePriority({ ...item, completed: false });
  return nextPriority === 'done' ? 'low' : nextPriority;
}

function createLiveMeeting(uploadResult: UploadResult): MeetingFeedItem {
  const durationMinutes = Math.max(1, Math.round(uploadResult.duration_seconds / 60));
  const normalizedStatus = normalizeMeetingStatus(uploadResult.status);

  return {
    id: uploadResult.id,
    title: uploadResult.title || 'Latest uploaded meeting',
    durationMinutes,
    participants: 3,
    status: normalizedStatus,
    tags: (uploadResult.title || 'Meeting Brief').split(/\s+/).slice(0, 3),
    dayLabel: formatDayLabel(uploadResult.created_at),
    sortAt: uploadResult.created_at || new Date().toISOString(),
    source: normalizedStatus === 'uploaded' ? 'uploaded' : 'recorded',
    participantInitials: ['AJ', 'SK', 'TB'],
    extraParticipants: 0,
  };
}

function App() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const recorderSectionRef = useRef<HTMLDivElement | null>(null);
  const artifactsSectionRef = useRef<HTMLElement | null>(null);

  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE);
  const [activeView, setActiveView] = useState<ActiveView>('meetings');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authToken, setAuthToken] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? '';
  });
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [meetingSearch, setMeetingSearch] = useState('');
  const [meetingFilter, setMeetingFilter] = useState<'all' | MeetingFeedStatus>('all');
  const [meetingSort, setMeetingSort] = useState<'newest' | 'oldest'>('newest');
  const [meetingsViewMode, setMeetingsViewMode] = useState<MeetingsViewMode>('list');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [meetingDetailTab, setMeetingDetailTab] = useState<MeetingDetailTab>('summary');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [audioPlaybackRate, setAudioPlaybackRate] = useState(1);
  const [isAudioSimPlaying, setIsAudioSimPlaying] = useState(false);
  const [audioCurrentSecond, setAudioCurrentSecond] = useState(0);
  const [meetingDetailNotice, setMeetingDetailNotice] = useState('');
  const [seededActionOverrides, setSeededActionOverrides] = useState<Record<string, boolean>>({});
  const [actionBoardFilter, setActionBoardFilter] = useState<ActionBoardFilter>('all');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('transcription');
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('English (US)');
  const [speakerDiarizationEnabled, setSpeakerDiarizationEnabled] = useState(true);
  const [autoPunctuationEnabled, setAutoPunctuationEnabled] = useState(true);
  const [filterFillerWordsEnabled, setFilterFillerWordsEnabled] = useState(false);
  const [profanityFilterEnabled, setProfanityFilterEnabled] = useState(false);
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
  const [storedMeetings, setStoredMeetings] = useState<UploadResult[]>([]);
  const [detailTranscriptText, setDetailTranscriptText] = useState('');
  const [detailSummaryText, setDetailSummaryText] = useState('');
  const [detailActionItems, setDetailActionItems] = useState<ActionItem[]>([]);
  const [isMeetingDetailLoading, setIsMeetingDetailLoading] = useState(false);
  const [meetingDetailError, setMeetingDetailError] = useState('');
  const [newActionItemDescription, setNewActionItemDescription] = useState('');
  const [newActionItemOwner, setNewActionItemOwner] = useState('');
  const [newActionItemDueAt, setNewActionItemDueAt] = useState('');
  const [artifactsMessage, setArtifactsMessage] = useState('No transcript, summary, or action items saved yet.');
  const [artifactsError, setArtifactsError] = useState('');
  const [isSavingArtifacts, setIsSavingArtifacts] = useState(false);

  const mimeType = useMemo(() => getSupportedMimeType(), []);
  const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!mimeType;
  const pendingActionItems = actionItems.filter((item) => !item.completed);
  const completedActionItems = actionItems.length - pendingActionItems.length;
  const recordedHours = (uploadResult?.duration_seconds ?? elapsedSeconds) / 3600;
  const summaryCount = summaryText.trim() ? 1 : 0;
  const transcriptCount = transcriptText.trim() ? 1 : 0;
  const formattedToday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  const meetingFeed = useMemo(() => {
    const liveMeetings = storedMeetings.map((meeting) => createLiveMeeting(meeting));
    const items = liveMeetings.length ? liveMeetings : [...SEEDED_MEETINGS];

    if (uploadResult) {
      const hasLatestMeeting = items.some((item) => item.id === uploadResult.id);
      if (!hasLatestMeeting) {
        items.unshift(createLiveMeeting(uploadResult));
      }
    } else if (title.trim() || audioBlob || recordingState !== 'idle') {
      items.unshift({
        id: 'draft-meeting',
        title: title.trim() || 'Current draft meeting',
        durationMinutes: Math.max(1, Math.round(Math.max(elapsedSeconds, 60) / 60)),
        participants: 2,
        status: recordingState === 'uploading' ? 'processing' : 'uploaded',
        tags: ['Draft', 'Local'],
        dayLabel: 'TODAY',
        sortAt: new Date().toISOString(),
        source: 'recorded',
        participantInitials: ['AJ', 'SK'],
        extraParticipants: 0,
      });
    }

    return items;
  }, [storedMeetings, uploadResult, title, audioBlob, recordingState, elapsedSeconds]);
  const recentMeetings = useMemo(() => {
    return meetingFeed.slice(0, 3).map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      subtitle: `${formatMinutesLabel(meeting.durationMinutes)} • ${meeting.status}`,
      status: meeting.status,
      tags: meeting.tags,
      accent: meeting.status === 'done' ? 'sage' : meeting.status === 'processing' ? 'amber' : 'blue',
    }));
  }, [meetingFeed]);
  const filteredMeetings = useMemo(() => {
    const searchTerm = meetingSearch.trim().toLowerCase();
    const filtered = meetingFeed.filter((meeting) => {
      const matchesFilter = meetingFilter === 'all' || meeting.status === meetingFilter;
      const matchesSearch =
        !searchTerm ||
        meeting.title.toLowerCase().includes(searchTerm) ||
        meeting.tags.some((tag) => tag.toLowerCase().includes(searchTerm));

      return matchesFilter && matchesSearch;
    });

    return filtered.sort((left, right) => {
      const leftTime = new Date(left.sortAt).getTime();
      const rightTime = new Date(right.sortAt).getTime();
      return meetingSort === 'newest' ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [meetingFeed, meetingFilter, meetingSearch, meetingSort]);
  const groupedMeetings = useMemo(() => {
    const groups: Array<{ label: string; items: MeetingFeedItem[] }> = [];

    filteredMeetings.forEach((meeting) => {
      const existingGroup = groups.find((group) => group.label === meeting.dayLabel);
      if (existingGroup) {
        existingGroup.items.push(meeting);
        return;
      }

      groups.push({ label: meeting.dayLabel, items: [meeting] });
    });

    return groups;
  }, [filteredMeetings]);
  const totalMeetingHours = meetingFeed.reduce((sum, meeting) => sum + meeting.durationMinutes, 0) / 60;
  const selectedMeeting = useMemo(
    () => meetingFeed.find((meeting) => meeting.id === selectedMeetingId) ?? null,
    [meetingFeed, selectedMeetingId],
  );
  const selectedStoredMeeting = useMemo(() => {
    if (!selectedMeetingId) {
      return null;
    }

    return storedMeetings.find((meeting) => meeting.id === selectedMeetingId) ?? (uploadResult?.id === selectedMeetingId ? uploadResult : null);
  }, [selectedMeetingId, storedMeetings, uploadResult]);
  const seededMeetingDetail = useMemo(
    () => (selectedMeeting && selectedMeeting.id.startsWith('seed-') ? buildSeedMeetingDetail(selectedMeeting) : null),
    [selectedMeeting],
  );
  const detailSummaryParagraphs = useMemo(
    () => detailSummaryText.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean),
    [detailSummaryText],
  );
  const detailTranscriptParagraphs = useMemo(
    () => detailTranscriptText.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean),
    [detailTranscriptText],
  );
  const detailAudioMetadata = useMemo(() => {
    if (seededMeetingDetail) {
      return seededMeetingDetail.audioMetadata;
    }

    return selectedMeeting ? getDefaultAudioMetadata(selectedMeeting) : null;
  }, [seededMeetingDetail, selectedMeeting]);
  const detailMeetingActionItems = useMemo<MeetingDetailActionItem[]>(() => {
    if (seededMeetingDetail) {
      return seededMeetingDetail.actionItems.map((item) => {
        const completed = seededActionOverrides[item.id] ?? item.completed;
        const basePriority = item.basePriority ?? (item.priority === 'done' ? 'low' : item.priority);

        return {
          ...item,
          completed,
          priority: completed ? 'done' : basePriority,
          basePriority,
        };
      });
    }

    return detailActionItems.map((item) => ({
      id: `detail-${item.id}`,
      title: item.description,
      assigneeName: item.owner_name || 'Unassigned',
      assigneeInitials: getInitials(item.owner_name),
      dueLabel: formatDueLabel(item.due_at),
      completed: item.completed,
      priority: derivePriority(item),
      basePriority: deriveBasePriority(item),
      isLive: true,
      actionItemId: item.id,
    }));
  }, [detailActionItems, seededActionOverrides, seededMeetingDetail]);
  const detailParticipants = useMemo(() => {
    if (seededMeetingDetail) {
      return seededMeetingDetail.participants;
    }

    const meetingOwnerName = currentUser?.name || currentUser?.email || 'Meeting owner';

    return [
      {
        initials: getInitials(meetingOwnerName),
        name: meetingOwnerName,
        role: 'Meeting owner',
        note: 'Organizer',
      },
      { initials: 'TM', name: 'Team Member', role: 'Participant' },
      { initials: 'ST', name: 'Stakeholder', role: 'Participant' },
    ];
  }, [currentUser?.email, currentUser?.name, seededMeetingDetail]);
  const detailDiscussionPoints = useMemo(() => {
    if (seededMeetingDetail) {
      return seededMeetingDetail.discussionPoints;
    }

    if (detailSummaryParagraphs.length) {
      return detailSummaryParagraphs;
    }

    return ['No summary has been saved for this meeting yet.'];
  }, [detailSummaryParagraphs, seededMeetingDetail]);
  const detailTranscriptSegments = useMemo(() => {
    if (seededMeetingDetail) {
      return seededMeetingDetail.transcriptSegments;
    }

    return buildTranscriptSegmentsFromParagraphs(detailTranscriptParagraphs, detailParticipants);
  }, [detailParticipants, detailTranscriptParagraphs, seededMeetingDetail]);
  const filteredTranscriptSegments = useMemo(() => {
    const query = transcriptSearch.trim().toLowerCase();
    if (!query) {
      return detailTranscriptSegments;
    }

    return detailTranscriptSegments.filter(
      (segment) =>
        segment.text.toLowerCase().includes(query) ||
        segment.speakerName.toLowerCase().includes(query) ||
        segment.timestampLabel.includes(query),
    );
  }, [detailTranscriptSegments, transcriptSearch]);
  const transcriptMatchCount = useMemo(() => {
    return detailTranscriptSegments.reduce(
      (count, segment) =>
        count + countQueryMatches(segment.text, transcriptSearch) + countQueryMatches(segment.speakerName, transcriptSearch) + countQueryMatches(segment.timestampLabel, transcriptSearch),
      0,
    );
  }, [detailTranscriptSegments, transcriptSearch]);
  const detailPendingCount = useMemo(
    () => detailMeetingActionItems.filter((item) => !item.completed).length,
    [detailMeetingActionItems],
  );
  const detailMeetingDateTime = useMemo(
    () => `${formatMeetingDateLabel(selectedStoredMeeting?.created_at ?? selectedMeeting?.sortAt ?? null)} at ${formatMeetingTimeLabel(selectedStoredMeeting?.created_at ?? selectedMeeting?.sortAt ?? null)}`,
    [selectedMeeting?.sortAt, selectedStoredMeeting?.created_at],
  );
  const selectedMeetingDurationSeconds = useMemo(() => {
    if (selectedStoredMeeting?.duration_seconds) {
      return selectedStoredMeeting.duration_seconds;
    }
    if (selectedMeeting) {
      return selectedMeeting.durationMinutes * 60;
    }
    return 0;
  }, [selectedMeeting, selectedStoredMeeting]);
  const audioDownloadHref = useMemo(() => {
    if (selectedStoredMeeting?.audio_url) {
      return selectedStoredMeeting.audio_url;
    }
    if (audioBlob && selectedMeeting?.id === 'draft-meeting') {
      return URL.createObjectURL(audioBlob);
    }
    return null;
  }, [audioBlob, selectedMeeting?.id, selectedStoredMeeting?.audio_url]);
  const audioProgressPercent = selectedMeetingDurationSeconds
    ? Math.min(100, (audioCurrentSecond / selectedMeetingDurationSeconds) * 100)
    : 0;
  const detailDecisions = useMemo(() => {
    if (seededMeetingDetail) {
      return seededMeetingDetail.decisions;
    }

    if (detailMeetingActionItems.length) {
      return detailMeetingActionItems.slice(0, 3).map((item) => ({
        title: item.title,
        body: item.completed ? 'Completed and captured from meeting follow-ups.' : `Assigned to ${item.assigneeName}${item.dueLabel ? `, ${item.dueLabel.toLowerCase()}` : ''}.`,
      }));
    }

    return [{ title: 'No decisions captured yet', body: 'Save a summary or action items to show concrete decisions here.' }];
  }, [detailMeetingActionItems, seededMeetingDetail]);
  const detailTlDr = seededMeetingDetail?.tlDr || detailSummaryParagraphs[0] || 'No summary has been saved for this meeting yet.';

  useEffect(() => {
    setTranscriptSearch('');
    setAudioPlaybackRate(1);
    setAudioCurrentSecond(0);
    setIsAudioSimPlaying(false);
    setMeetingDetailNotice('');
    setSeededActionOverrides({});
  }, [selectedMeetingId]);

  useEffect(() => {
    if (!audioDownloadHref || !audioBlob || selectedMeeting?.id !== 'draft-meeting') {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(audioDownloadHref);
    };
  }, [audioBlob, audioDownloadHref, selectedMeeting?.id]);

  useEffect(() => {
    if (!isAudioSimPlaying || !selectedMeetingDurationSeconds) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setAudioCurrentSecond((current) => {
        const nextValue = current + audioPlaybackRate;
        if (nextValue >= selectedMeetingDurationSeconds) {
          window.clearInterval(intervalId);
          setIsAudioSimPlaying(false);
          return selectedMeetingDurationSeconds;
        }
        return nextValue;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [audioPlaybackRate, isAudioSimPlaying, selectedMeetingDurationSeconds]);
  const actionBoardItems = useMemo(() => {
    const liveItems = actionItems.map((item) => ({
      id: `live-${item.id}`,
      title: item.description,
      sourceMeeting: uploadResult?.title || 'Current meeting',
      priority: derivePriority(item),
      dueLabel: formatDueLabel(item.due_at),
      completed: item.completed,
      assigneeInitials: getInitials(item.owner_name),
      isLive: true,
      actionItemId: item.id,
    } satisfies ActionBoardItem));

    return [...liveItems, ...SEEDED_ACTION_ITEMS];
  }, [actionItems, uploadResult]);
  const actionBoardCounts = useMemo(() => {
    const completed = actionBoardItems.filter((item) => item.completed).length;
    const pending = actionBoardItems.length - completed;
    const dueToday = actionBoardItems.filter((item) => !item.completed && item.dueLabel === 'Due today').length;
    const high = actionBoardItems.filter((item) => !item.completed && item.priority === 'high').length;
    const medium = actionBoardItems.filter((item) => !item.completed && item.priority === 'medium').length;
    const low = actionBoardItems.filter((item) => !item.completed && item.priority === 'low').length;

    return { completed, pending, dueToday, high, medium, low };
  }, [actionBoardItems]);
  const filteredActionBoardItems = useMemo(() => {
    return actionBoardItems.filter((item) => {
      if (actionBoardFilter === 'all') {
        return true;
      }
      if (actionBoardFilter === 'pending') {
        return !item.completed;
      }
      if (actionBoardFilter === 'done') {
        return item.completed;
      }
      if (actionBoardFilter === 'high') {
        return !item.completed && item.priority === 'high';
      }
      if (actionBoardFilter === 'due-today') {
        return !item.completed && item.dueLabel === 'Due today';
      }
      return true;
    });
  }, [actionBoardItems, actionBoardFilter]);
  const actionBoardGroups = useMemo(() => {
    return [
      {
        key: 'due-today',
        title: 'Due Today',
        items: filteredActionBoardItems.filter((item) => !item.completed && item.dueLabel === 'Due today'),
      },
      {
        key: 'high',
        title: 'High Priority',
        items: filteredActionBoardItems.filter((item) => !item.completed && item.dueLabel !== 'Due today' && item.priority === 'high'),
      },
      {
        key: 'medium',
        title: 'Medium Priority',
        items: filteredActionBoardItems.filter((item) => !item.completed && item.priority === 'medium'),
      },
      {
        key: 'low',
        title: 'Low Priority',
        items: filteredActionBoardItems.filter((item) => !item.completed && item.priority === 'low'),
      },
      {
        key: 'done',
        title: 'Completed',
        items: filteredActionBoardItems.filter((item) => item.completed),
      },
    ].filter((group) => group.items.length > 0);
  }, [filteredActionBoardItems]);

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

  useEffect(() => {
    async function runVerifySession() {
      setIsAuthReady(false);

      try {
        const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
        const response = await fetch(`${normalizedApiBase}/auth/verify`, { headers });

        if (!response.ok) {
          if (response.status === 401) {
            setCurrentUser(null);
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
            }
            setAuthToken('');
            setIsAuthReady(true);
            return;
          }

          throw new Error(await getErrorMessage(response));
        }

        const data = (await response.json()) as VerifyResponse;
        setCurrentUser(data.user);
        setAuthError('');
      } catch (error) {
        setAuthError(formatAppError(error, apiBaseUrl, 'Unable to verify your session.'));
        setCurrentUser(null);
      } finally {
        setIsAuthReady(true);
      }
    }

    void runVerifySession();
  }, [apiBaseUrl, authToken]);

  useEffect(() => {
    if (!currentUser) {
      setStoredMeetings([]);
      return;
    }

    async function runRefreshMeetings() {
      try {
        const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
        const response = await fetch(`${normalizedApiBase}/meetings`, { headers });
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const meetings = (await response.json()) as UploadResult[];
        setStoredMeetings(meetings);
      } catch {
        setStoredMeetings([]);
      }
    }

    void runRefreshMeetings();
  }, [currentUser, apiBaseUrl, authToken]);

  useEffect(() => {
    if (!selectedMeetingId || meetingsViewMode !== 'detail' || !selectedMeeting) {
      return;
    }

    const meetingId = selectedMeeting.id;

    if (meetingId.startsWith('seed-')) {
      setIsMeetingDetailLoading(false);
      setMeetingDetailError('');
      return;
    }

    if (meetingId === 'draft-meeting') {
      setDetailTranscriptText(transcriptText);
      setDetailSummaryText(summaryText);
      setDetailActionItems(actionItems);
      setMeetingDetailError('');
      setIsMeetingDetailLoading(false);
      return;
    }

    let isCancelled = false;

    async function loadMeetingDetail() {
      setIsMeetingDetailLoading(true);
      setMeetingDetailError('');

      try {
        const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
        const requestHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
        const loadOptionalJson = async <T,>(url: string): Promise<T | null> => {
          const response = await fetch(url, { headers: requestHeaders });
          if (response.status === 404) {
            return null;
          }
          if (!response.ok) {
            throw new Error(await getErrorMessage(response));
          }
          return (await response.json()) as T;
        };
        const loadRequiredJson = async <T,>(url: string): Promise<T> => {
          const response = await fetch(url, { headers: requestHeaders });
          if (!response.ok) {
            throw new Error(await getErrorMessage(response));
          }
          return (await response.json()) as T;
        };
        const [transcript, summary, items] = await Promise.all([
          loadOptionalJson<TranscriptResult>(`${normalizedApiBase}/meetings/${meetingId}/transcript`),
          loadOptionalJson<SummaryResult>(`${normalizedApiBase}/meetings/${meetingId}/summary`),
          loadRequiredJson<ActionItem[]>(`${normalizedApiBase}/meetings/${meetingId}/action-items`),
        ]);

        if (isCancelled) {
          return;
        }

        setDetailTranscriptText(transcript?.transcript_text ?? '');
        setDetailSummaryText(summary?.summary_text ?? '');
        setDetailActionItems(items);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setMeetingDetailError(error instanceof Error ? error.message : 'Unable to load meeting details.');
        setDetailTranscriptText('');
        setDetailSummaryText('');
        setDetailActionItems([]);
      } finally {
        if (!isCancelled) {
          setIsMeetingDetailLoading(false);
        }
      }
    }

    void loadMeetingDetail();

    return () => {
      isCancelled = true;
    };
  }, [selectedMeetingId, meetingsViewMode, selectedMeeting, apiBaseUrl, authToken, actionItems, summaryText, transcriptText]);

  async function authorizedFetch(input: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }

    return fetch(input, {
      ...init,
      headers,
    });
  }

  async function refreshMeetings() {
    const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
    const response = await authorizedFetch(`${normalizedApiBase}/meetings`);
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const meetings = (await response.json()) as UploadResult[];
    setStoredMeetings(meetings);
  }

  async function submitAuth() {
    setIsAuthenticating(true);
    setAuthError('');

    try {
      const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
      const endpoint = authMode === 'login' ? 'login' : 'register';
      const response = await fetch(`${normalizedApiBase}/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
          name: authMode === 'register' ? authName.trim() || null : null,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const session = (await response.json()) as AuthSession;
      setAuthToken(session.access_token);
      setCurrentUser(session.user);
      setAuthPassword('');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.access_token);
      }
      await refreshMeetings();
    } catch (error) {
      setAuthError(formatAppError(error, apiBaseUrl, 'Unable to authenticate.'));
    } finally {
      setIsAuthenticating(false);
    }
  }

  function logout() {
    setAuthToken('');
    setCurrentUser(null);
    setUploadResult(null);
    setStoredMeetings([]);
    setActionItems([]);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  }

  async function fetchOptionalJson<T>(url: string): Promise<T | null> {
    const response = await authorizedFetch(url);
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
      authorizedFetch(`${normalizedApiBase}/meetings/${meetingId}/action-items`).then(async (response) => {
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
      const startResponse = await authorizedFetch(`${normalizedApiBase}/meetings/start`, {
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
      const uploadResponse = await authorizedFetch(`${normalizedApiBase}/meetings/${startedMeeting.id}/upload-audio`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(await getErrorMessage(uploadResponse));
      }

      setStatusMessage('Finalizing meeting...');
      const finalizeResponse = await authorizedFetch(`${normalizedApiBase}/meetings/${startedMeeting.id}/finalize`, {
        method: 'POST',
      });

      if (!finalizeResponse.ok) {
        throw new Error(await getErrorMessage(finalizeResponse));
      }

      const data = (await finalizeResponse.json()) as UploadResult;
      setUploadResult(data);
  await refreshMeetings();
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
      const response = await authorizedFetch(`${normalizedApiBase}/meetings/${uploadResult.id}/transcript`, {
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
      const response = await authorizedFetch(`${normalizedApiBase}/meetings/${uploadResult.id}/summary`, {
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
      const response = await authorizedFetch(`${normalizedApiBase}/meetings/${uploadResult.id}/action-items`, {
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

  async function updateActionItem(item: ActionItem, patch: Partial<ActionItem>, meetingId = uploadResult?.id) {
    if (!meetingId) {
      return;
    }

    setIsSavingArtifacts(true);
    setArtifactsError('');

    try {
      const normalizedApiBase = apiBaseUrl.replace(/\/$/, '');
      const response = await authorizedFetch(`${normalizedApiBase}/meetings/${meetingId}/action-items/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await refreshArtifacts(meetingId);
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
      const response = await authorizedFetch(`${normalizedApiBase}/meetings/${uploadResult.id}/action-items/${itemId}`, {
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

  function jumpToRecorder() {
    setActiveView('dashboard');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        recorderSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function openMeetingDetails(meetingId: string) {
    setSelectedMeetingId(meetingId);
    setMeetingDetailTab('summary');
    setMeetingsViewMode('detail');
  }

  async function openSelectedMeetingArtifacts() {
    if (!selectedStoredMeeting) {
      return;
    }

    setUploadResult(selectedStoredMeeting);
    await refreshArtifacts(selectedStoredMeeting.id);
    jumpToArtifacts();
  }

  function jumpToArtifacts() {
    setActiveView('dashboard');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        artifactsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  async function toggleActionBoardItem(item: ActionBoardItem) {
    if (!item.isLive || item.actionItemId === undefined) {
      return;
    }

    const liveItem = actionItems.find((candidate) => candidate.id === item.actionItemId);
    if (!liveItem) {
      return;
    }

    await updateActionItem(liveItem, { completed: !liveItem.completed });
  }

  function triggerTextDownload(filename: string, content: string) {
    const fileBlob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(fileBlob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function exportMeetingDetails() {
    if (!selectedMeeting) {
      return;
    }

    const exportSections = [
      `${selectedMeeting.title}`,
      `${detailMeetingDateTime}`,
      '',
      'TL;DR',
      detailTlDr,
      '',
      'Key Discussion Points',
      ...detailDiscussionPoints.map((point) => `- ${point}`),
      '',
      'Decisions Made',
      ...detailDecisions.map((decision) => `- ${decision.title}: ${decision.body}`),
      '',
      'Action Items',
      ...detailMeetingActionItems.map(
        (item) => `- [${item.completed ? 'x' : ' '}] ${item.title} (${item.assigneeInitials}${item.dueLabel ? `, ${item.dueLabel}` : ''})`,
      ),
    ];

    triggerTextDownload(`${selectedMeeting.title.replace(/\s+/g, '-').toLowerCase() || 'meeting'}-brief.txt`, exportSections.join('\n'));
    setMeetingDetailNotice('Meeting brief exported.');
  }

  async function shareMeetingDetails() {
    if (!selectedMeeting) {
      return;
    }

    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}#meeting=${selectedMeeting.id}` : selectedMeeting.id;
    const sharePayload = `${selectedMeeting.title}\n${detailMeetingDateTime}\n${shareUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedMeeting.title,
          text: `${selectedMeeting.title} meeting brief`,
          url: shareUrl,
        });
        setMeetingDetailNotice('Share sheet opened.');
        return;
      }

      await navigator.clipboard.writeText(sharePayload);
      setMeetingDetailNotice('Meeting link copied to clipboard.');
    } catch {
      setMeetingDetailNotice('Unable to share from this browser.');
    }
  }

  function downloadTranscriptFile() {
    if (!selectedMeeting || !detailTranscriptSegments.length) {
      return;
    }

    const transcriptContent = detailTranscriptSegments
      .map((segment) => `[${segment.timestampLabel}] ${segment.speakerName}: ${segment.text}`)
      .join('\n\n');

    triggerTextDownload(`${selectedMeeting.title.replace(/\s+/g, '-').toLowerCase() || 'meeting'}-transcript.txt`, transcriptContent);
    setMeetingDetailNotice('Transcript downloaded.');
  }

  function toggleDetailActionItem(item: MeetingDetailActionItem) {
    if (item.isLive && item.actionItemId !== undefined) {
      const liveItem = detailActionItems.find((candidate) => candidate.id === item.actionItemId);
      if (liveItem && selectedStoredMeeting) {
        void updateActionItem(liveItem, { completed: !liveItem.completed }, selectedStoredMeeting.id);
      }
      return;
    }

    setSeededActionOverrides((current) => ({
      ...current,
      [item.id]: !(current[item.id] ?? item.completed),
    }));
  }

  if (!isAuthReady) {
    return <main className="auth-shell"><section className="auth-card"><p className="auth-copy">Checking your session...</p></section></main>;
  }

  if (!currentUser) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="sidebar-brand auth-brand">
            <div className="brand-mark">R</div>
            <div>
              <p className="brand-name auth-brand-name">Recall</p>
              <p className="brand-subtitle auth-brand-subtitle">Sign in to store meetings and action items by user.</p>
            </div>
          </div>

          <div className="auth-toggle-row">
            <button className={`filter-pill${authMode === 'login' ? ' filter-pill--active' : ''}`} type="button" onClick={() => setAuthMode('login')}>Log In</button>
            <button className={`filter-pill${authMode === 'register' ? ' filter-pill--active' : ''}`} type="button" onClick={() => setAuthMode('register')}>Create Account</button>
          </div>

          {authMode === 'register' ? (
            <>
              <label className="field-label" htmlFor="authName">Name</label>
              <input id="authName" className="text-input" value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Alex Johnson" />
            </>
          ) : null}

          <label className="field-label" htmlFor="authEmail">Email</label>
          <input id="authEmail" className="text-input" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="alex@example.com" />

          <label className="field-label" htmlFor="authPassword">Password</label>
          <input id="authPassword" className="text-input" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Enter a password" />

          {authError ? <p className="error-banner">{authError}</p> : null}

          <div className="button-row">
            <button className="primary-button" type="button" onClick={() => void submitAuth()} disabled={isAuthenticating || !authEmail.trim() || !authPassword.trim() || (authMode === 'register' && !authName.trim())}>
              {isAuthenticating ? 'Working...' : authMode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">R</div>
          <div>
            <p className="brand-name">Recall</p>
            <p className="brand-subtitle">Local workspace</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <button className={`nav-item${activeView === 'dashboard' ? ' nav-item--active' : ''}`} type="button" onClick={() => setActiveView('dashboard')}>Dashboard</button>
          <button className={`nav-item${activeView === 'meetings' ? ' nav-item--active' : ''}`} type="button" onClick={() => setActiveView('meetings')}>Meetings <span>{meetingFeed.length}</span></button>
          <button className={`nav-item${activeView === 'action-items' ? ' nav-item--active' : ''}`} type="button" onClick={() => setActiveView('action-items')}>Action Items <span>{actionBoardCounts.pending}</span></button>
          <button className="nav-item" type="button" onClick={jumpToRecorder}>Recorder</button>
          <button className={`nav-item${activeView === 'settings' ? ' nav-item--active' : ''}`} type="button" onClick={() => setActiveView('settings')}>Settings</button>
        </nav>

        <div className="sidebar-footer">
          <div className="avatar-pill">AJ</div>
          <div>
            <p className="footer-name">{currentUser.name || currentUser.email}</p>
            <p className="footer-plan">{currentUser.email}</p>
          </div>
          <button className="sidebar-logout" type="button" onClick={logout}>Log out</button>
        </div>
      </aside>

      <section className="dashboard-main">
        {activeView === 'meetings' ? (
          <>
            {meetingsViewMode === 'list' ? (
              <>
                <header className="dashboard-header meetings-page-header">
                  <div>
                    <h1>Meetings</h1>
                    <p className="hero-copy">{meetingFeed.length} meetings • {totalMeetingHours.toFixed(1)} hrs recorded</p>
                  </div>
                  <button className="hero-button hero-button--outline" type="button" onClick={jumpToRecorder}>New Meeting</button>
                </header>

                <section className="meetings-banner">
                  <div>
                    <p className="meetings-banner-kicker">Have an existing recording?</p>
                    <p className="meetings-banner-copy">Upload audio to transcribe and summarise it.</p>
                  </div>
                  <button className="link-button meetings-banner-action" type="button" onClick={jumpToRecorder}>Open recorder</button>
                </section>

                <section className="meetings-toolbar">
                  <input
                    className="search-input"
                    value={meetingSearch}
                    onChange={(event) => setMeetingSearch(event.target.value)}
                    placeholder="Search meetings"
                  />

                  <div className="meetings-filter-row">
                    {MEETING_FILTERS.map((filterOption) => (
                      <button
                        key={filterOption.value}
                        className={`filter-pill${meetingFilter === filterOption.value ? ' filter-pill--active' : ''}`}
                        type="button"
                        onClick={() => setMeetingFilter(filterOption.value)}
                      >
                        {filterOption.label}
                      </button>
                    ))}
                  </div>

                  <div className="meetings-sort-row">
                    <label className="field-label" htmlFor="meetingSort">Sort</label>
                    <select
                      id="meetingSort"
                      className="sort-select"
                      value={meetingSort}
                      onChange={(event) => setMeetingSort(event.target.value as 'newest' | 'oldest')}
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                    </select>
                  </div>
                </section>

                <section className="meetings-list-shell">
                  {groupedMeetings.length ? (
                    groupedMeetings.map((group) => (
                      <section className="meeting-day-group" key={group.label}>
                        <p className="meeting-day-label">{group.label}</p>
                        <div className="meeting-list">
                          {group.items.map((meeting) => (
                            <button className="meeting-list-row" key={meeting.id} type="button" onClick={() => openMeetingDetails(meeting.id)}>
                              <div className={`meeting-list-icon meeting-list-icon--${meeting.source}`}>
                                {meeting.source === 'uploaded' ? 'UP' : 'REC'}
                              </div>

                              <div className="meeting-list-main">
                                <h3 className="meeting-list-title">{meeting.title}</h3>
                                <p className="meeting-list-meta">{formatMinutesLabel(meeting.durationMinutes)} • {meeting.participants} participants</p>
                                <div className="tag-row">
                                  {meeting.tags.map((tag) => (
                                    <span className="tag-chip tag-chip--dark" key={tag}>{tag}</span>
                                  ))}
                                </div>
                              </div>

                              <div className="meeting-list-tail">
                                <span className={`meeting-status-badge meeting-status-badge--${meeting.status}`}>{meeting.status}</span>
                                <div className="avatar-stack" aria-hidden="true">
                                  {meeting.participantInitials.map((initials) => (
                                    <span className="avatar-bubble" key={`${meeting.id}-${initials}`}>{initials}</span>
                                  ))}
                                  {meeting.extraParticipants ? <span className="avatar-bubble avatar-bubble--more">+{meeting.extraParticipants}</span> : null}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <div className="empty-state-card empty-state-card--dark">
                      <p className="empty-copy">No meetings matched that filter. Try another status or search term.</p>
                    </div>
                  )}
                </section>
              </>
            ) : selectedMeeting ? (
              <section className="meeting-detail-page">
                <header className="meeting-detail-header">
                  <div className="meeting-detail-breadcrumb-row">
                    <button className="meeting-detail-breadcrumb" type="button" onClick={() => setMeetingsViewMode('list')}>
                      Meetings
                    </button>
                    <span className="meeting-detail-breadcrumb-sep">/</span>
                    <span className="meeting-detail-breadcrumb-current">{selectedMeeting.title}</span>
                  </div>

                  <div className="meeting-detail-header-body">
                    <div className="meeting-detail-title-block">
                      <h1 className="meeting-detail-title">{selectedMeeting.title}</h1>
                      <div className="meeting-detail-meta-row">
                        <span className={`meeting-status-badge meeting-status-badge--${selectedMeeting.status}`}>{selectedMeeting.status}</span>
                        <span className="meeting-detail-meta-chip">{detailMeetingDateTime}</span>
                        <span className="meeting-detail-meta-chip">{formatMinutesLabel(selectedMeeting.durationMinutes)}</span>
                        <span className="meeting-detail-meta-chip">{selectedMeeting.participants} participants</span>
                        <div className="avatar-stack meeting-detail-avatar-stack" aria-hidden="true">
                          {selectedMeeting.participantInitials.map((initials) => (
                            <span className="avatar-bubble" key={`${selectedMeeting.id}-${initials}`}>{initials}</span>
                          ))}
                          {selectedMeeting.extraParticipants ? <span className="avatar-bubble avatar-bubble--more">+{selectedMeeting.extraParticipants}</span> : null}
                        </div>
                        {selectedMeeting.tags.map((tag) => (
                          <span className="meeting-detail-tag" key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>

                    <div className="meeting-detail-actions">
                      <button className="meeting-detail-secondary-button" type="button" onClick={exportMeetingDetails}>Export</button>
                      <button className="meeting-detail-secondary-button" type="button" onClick={() => void shareMeetingDetails()}>Share</button>
                      <button className="meeting-detail-primary-button" type="button" onClick={() => void openSelectedMeetingArtifacts()} disabled={!selectedStoredMeeting}>
                        + Add action item
                      </button>
                    </div>
                  </div>

                  {meetingDetailNotice ? <p className="meeting-detail-notice">{meetingDetailNotice}</p> : null}
                </header>

                <section className="meeting-detail-tabs" aria-label="Meeting detail tabs">
                  {MEETING_DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      className={`meeting-detail-tab${meetingDetailTab === tab.value ? ' meeting-detail-tab--active' : ''}`}
                      type="button"
                      onClick={() => setMeetingDetailTab(tab.value)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </section>

                <section className="meeting-detail-body">
                  <div className="meeting-detail-main-column">
                    {isMeetingDetailLoading ? <p className="meeting-detail-helper">Loading meeting details...</p> : null}
                    {meetingDetailError ? <p className="error-banner">{meetingDetailError}</p> : null}

                    {meetingDetailTab === 'summary' ? (
                      <div className="meeting-detail-stack">
                        <section className="meeting-detail-summary-section">
                          <p className="meeting-detail-section-label">AI-generated output via MCP</p>
                          <article className="meeting-detail-tldr-box">
                            <p className="meeting-detail-tldr-label">TL;DR</p>
                            <p className="meeting-detail-tldr">{detailTlDr}</p>
                          </article>
                        </section>

                        <section className="meeting-detail-summary-section">
                          <p className="meeting-detail-section-label">Key discussion points</p>
                          <div className="meeting-detail-bullets">
                            {detailDiscussionPoints.map((point) => (
                              <div className="meeting-detail-bullet" key={point}>
                                <span className="meeting-detail-bullet-dot" />
                                <p>{point}</p>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section className="meeting-detail-summary-section">
                          <p className="meeting-detail-section-label">Decisions made</p>
                          <div className="meeting-detail-decision-list">
                            {detailDecisions.map((decision) => (
                              <article className="meeting-detail-decision-card" key={decision.title}>
                                <h3>{decision.title}</h3>
                                <p>{decision.body}</p>
                              </article>
                            ))}
                          </div>
                        </section>

                        <section className="meeting-detail-summary-section">
                          <p className="meeting-detail-section-label">Participants</p>
                          <div className="meeting-detail-participants">
                            {detailParticipants.map((participant) => (
                              <article className="meeting-detail-participant" key={participant.name}>
                                <span className="avatar-bubble meeting-detail-participant-avatar">{participant.initials}</span>
                                <div>
                                  <h3>{participant.name}</h3>
                                  <p>{participant.role}{participant.note ? ` • ${participant.note}` : ''}</p>
                                </div>
                              </article>
                            ))}
                          </div>
                        </section>
                      </div>
                    ) : meetingDetailTab === 'transcript' ? (
                      <section className="meeting-detail-transcript-card">
                        <div className="meeting-detail-transcript-header">
                          <div>
                            <p className="meeting-detail-section-label">Transcript</p>
                            <p className="meeting-detail-helper">Speaker-attributed blocks with timestamps. Search highlights matches across the full transcript.</p>
                          </div>

                          <div className="meeting-detail-transcript-search-shell">
                            <input
                              className="meeting-detail-search"
                              value={transcriptSearch}
                              onChange={(event) => setTranscriptSearch(event.target.value)}
                              placeholder="Search transcript..."
                            />
                            {transcriptSearch.trim() ? <span className="meeting-detail-search-count">{transcriptMatchCount} matches</span> : null}
                          </div>
                        </div>

                        {detailTranscriptSegments.length ? (
                          <div className="meeting-detail-transcript-list">
                            {detailTranscriptSegments.map((segment) => (
                              <article className="meeting-detail-transcript-block" key={segment.id}>
                                <div className="meeting-detail-transcript-speaker">
                                  <span className="avatar-bubble meeting-detail-transcript-avatar">{segment.speakerInitials}</span>
                                  <div>
                                    <h3>{segment.speakerName}</h3>
                                    <p>{segment.timestampLabel}</p>
                                  </div>
                                </div>
                                <p className="meeting-detail-transcript-text">{renderHighlightedText(segment.text, transcriptSearch)}</p>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="meeting-detail-helper">No transcript has been saved for this meeting yet.</p>
                        )}

                        {transcriptSearch.trim() && !filteredTranscriptSegments.length ? <p className="meeting-detail-helper">No blocks matched that search.</p> : null}
                      </section>
                    ) : (
                      <section className="meeting-detail-audio-card">
                        <div className="meeting-detail-audio-header">
                          <div>
                            <p className="meeting-detail-section-label">Audio</p>
                            <p className="meeting-detail-helper">Simulated player with speed control, downloads, and transcription metadata.</p>
                          </div>
                          <div className="meeting-detail-audio-actions">
                            <a
                              className={`meeting-detail-secondary-button meeting-detail-download${audioDownloadHref ? '' : ' meeting-detail-download--disabled'}`}
                              href={audioDownloadHref ?? undefined}
                              download={`${selectedMeeting.title.replace(/\s+/g, '-').toLowerCase() || 'meeting'}.audio`}
                              onClick={(event) => {
                                if (!audioDownloadHref) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              Download audio
                            </a>
                            <button className="meeting-detail-secondary-button" type="button" onClick={downloadTranscriptFile}>
                              Download transcript
                            </button>
                          </div>
                        </div>

                        {(selectedStoredMeeting?.audio_url || (audioBlob && selectedMeeting.id === 'draft-meeting') || seededMeetingDetail) ? (
                          <div className="meeting-detail-audio-shell">
                            <div className="meeting-detail-player-card">
                              <div className="meeting-detail-player-row">
                                <button className="meeting-detail-player-button" type="button" onClick={() => setIsAudioSimPlaying((current) => !current)}>
                                  {isAudioSimPlaying ? 'Pause' : 'Play'}
                                </button>
                                <button className="meeting-detail-player-button meeting-detail-player-button--ghost" type="button" onClick={() => {
                                  setIsAudioSimPlaying(false);
                                  setAudioCurrentSecond(0);
                                }}>
                                  Reset
                                </button>
                                <label className="meeting-detail-speed-control">
                                  <span>Speed</span>
                                  <select value={audioPlaybackRate} onChange={(event) => setAudioPlaybackRate(Number(event.target.value))}>
                                    <option value={0.75}>0.75x</option>
                                    <option value={1}>1x</option>
                                    <option value={1.25}>1.25x</option>
                                    <option value={1.5}>1.5x</option>
                                    <option value={2}>2x</option>
                                  </select>
                                </label>
                              </div>

                              <div className="meeting-detail-progress-shell">
                                <div className="meeting-detail-progress-bar">
                                  <span className="meeting-detail-progress-value" style={{ width: `${audioProgressPercent}%` }} />
                                </div>
                                <div className="meeting-detail-progress-labels">
                                  <span>{formatAudioTime(Math.floor(audioCurrentSecond))}</span>
                                  <span>{formatAudioTime(selectedMeetingDurationSeconds)}</span>
                                </div>
                              </div>
                            </div>

                            {detailAudioMetadata ? (
                              <div className="meeting-detail-audio-metadata-grid">
                                <article className="meeting-detail-audio-meta-card">
                                  <span className="meeting-detail-audio-meta-label">Format</span>
                                  <strong>{detailAudioMetadata.format}</strong>
                                </article>
                                <article className="meeting-detail-audio-meta-card">
                                  <span className="meeting-detail-audio-meta-label">Whisper model</span>
                                  <strong>{detailAudioMetadata.modelVersion}</strong>
                                </article>
                                <article className="meeting-detail-audio-meta-card">
                                  <span className="meeting-detail-audio-meta-label">Detected language</span>
                                  <strong>{detailAudioMetadata.language}</strong>
                                </article>
                                <article className="meeting-detail-audio-meta-card">
                                  <span className="meeting-detail-audio-meta-label">File size</span>
                                  <strong>{detailAudioMetadata.fileSizeLabel}</strong>
                                </article>
                                <article className="meeting-detail-audio-meta-card">
                                  <span className="meeting-detail-audio-meta-label">Uploaded</span>
                                  <strong>{detailMeetingDateTime}</strong>
                                </article>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <p className="meeting-detail-helper">No audio file is available for this meeting yet.</p>
                        )}
                      </section>
                    )}
                  </div>

                  <aside className="meeting-detail-side-column">
                    <section className="meeting-detail-side-card">
                      <div className="meeting-detail-side-header">
                        <h2>Action items</h2>
                        <span className="meeting-detail-action-count">{detailPendingCount} pending</span>
                      </div>

                      {detailMeetingActionItems.length ? (
                        <div className="meeting-detail-action-list">
                          {detailMeetingActionItems.map((item) => (
                            <article className="meeting-detail-action-row" key={item.id}>
                              <button
                                className={`action-board-checkbox${item.completed ? ' action-board-checkbox--checked' : ''}`}
                                type="button"
                                onClick={() => toggleDetailActionItem(item)}
                                disabled={item.isLive ? isSavingArtifacts : false}
                                aria-label={item.completed ? 'Mark item incomplete' : 'Mark item complete'}
                              >
                                {item.completed ? '✓' : ''}
                              </button>

                              <div className="meeting-detail-action-copy">
                                <p className={`meeting-detail-action-title${item.completed ? ' meeting-detail-action-title--done' : ''}`}>{item.title}</p>
                                <div className="meeting-detail-action-meta">
                                  <span className={`meeting-detail-priority meeting-detail-priority--${item.priority}`}>{item.completed ? 'Done' : item.priority}</span>
                                  <span>{item.assigneeInitials}</span>
                                  {item.dueLabel ? <span>{item.dueLabel}</span> : null}
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="meeting-detail-helper">No action items captured for this meeting yet.</p>
                      )}

                      <button className="meeting-detail-add-action" type="button" onClick={() => void openSelectedMeetingArtifacts()} disabled={!selectedStoredMeeting}>
                        + Add action item
                      </button>
                    </section>
                  </aside>
                </section>
              </section>
            ) : (
              <div className="empty-state-card empty-state-card--dark">
                <p className="empty-copy">Select a meeting to open its detail page.</p>
              </div>
            )}
          </>
        ) : activeView === 'action-items' ? (
          <>
            <header className="dashboard-header meetings-page-header">
              <div>
                <h1>Action Items</h1>
                <p className="hero-copy">{actionBoardItems.length} items • {actionBoardCounts.pending} pending • {actionBoardCounts.dueToday} due today</p>
              </div>
              <div className="action-board-header-actions">
                <button className="hero-button hero-button--outline" type="button" onClick={() => setActiveView('meetings')}>From meetings</button>
                <button className="hero-button hero-button--outline" type="button" onClick={jumpToArtifacts}>Add Item</button>
              </div>
            </header>

            <section className="action-board-summary">
              <div className="action-board-stat">
                <span className="action-board-stat-value">{actionBoardCounts.completed}</span>
                <span className="action-board-stat-label">Completed</span>
              </div>
              <div className="action-board-stat">
                <span className="action-board-stat-value">{actionBoardCounts.pending}</span>
                <span className="action-board-stat-label">Pending</span>
              </div>
              <div className="action-board-progress">
                <div className="action-board-progress-bar">
                  <span className="action-board-progress-segment action-board-progress-segment--high" style={{ width: `${(actionBoardCounts.high / Math.max(actionBoardCounts.pending, 1)) * 100}%` }} />
                  <span className="action-board-progress-segment action-board-progress-segment--medium" style={{ width: `${(actionBoardCounts.medium / Math.max(actionBoardCounts.pending, 1)) * 100}%` }} />
                  <span className="action-board-progress-segment action-board-progress-segment--low" style={{ width: `${(actionBoardCounts.low / Math.max(actionBoardCounts.pending, 1)) * 100}%` }} />
                  <span className="action-board-progress-segment action-board-progress-segment--done" style={{ width: `${(actionBoardCounts.completed / Math.max(actionBoardItems.length, 1)) * 100}%` }} />
                </div>
                <div className="action-board-legend">
                  <span><i className="legend-dot legend-dot--high" />High</span>
                  <span><i className="legend-dot legend-dot--medium" />Medium</span>
                  <span><i className="legend-dot legend-dot--low" />Low</span>
                  <span><i className="legend-dot legend-dot--done" />Done</span>
                </div>
              </div>
            </section>

            <section className="action-board-toolbar">
              <button className="filter-icon-button" type="button" aria-label="Search action items">⌕</button>
              <div className="meetings-filter-row">
                {ACTION_BOARD_FILTERS.map((filterOption) => (
                  <button
                    key={filterOption.value}
                    className={`filter-pill${actionBoardFilter === filterOption.value ? ' filter-pill--active' : ''}`}
                    type="button"
                    onClick={() => setActionBoardFilter(filterOption.value)}
                  >
                    {filterOption.label}
                  </button>
                ))}
              </div>
              <button className="filter-icon-button" type="button" aria-label="Layout options">≡</button>
            </section>

            <section className="action-items-page">
              {actionBoardGroups.length ? (
                actionBoardGroups.map((group) => (
                  <section className="action-board-group" key={group.key}>
                    <div className="action-board-group-header">
                      <div className="action-board-group-title-row">
                        <h2>{group.title}</h2>
                        <span className="action-board-count-pill">{group.items.length}</span>
                      </div>
                      <span className="action-board-collapse">⌄</span>
                    </div>

                    <div className="action-board-list">
                      {group.items.map((item) => (
                        <article className={`action-board-card${item.completed ? ' action-board-card--done' : ''}`} key={item.id}>
                          <button
                            className={`action-board-checkbox${item.completed ? ' action-board-checkbox--checked' : ''}`}
                            type="button"
                            onClick={() => void toggleActionBoardItem(item)}
                            disabled={!item.isLive || isSavingArtifacts}
                            aria-label={item.completed ? 'Mark item incomplete' : 'Mark item complete'}
                          >
                            {item.completed ? '✓' : ''}
                          </button>

                          <div className="action-board-main">
                            <p className={`action-board-title${item.completed ? ' action-board-title--done' : ''}`}>{item.title}</p>
                            <div className="action-board-meta-row">
                              <span className="action-board-meeting-chip">{item.sourceMeeting}</span>
                              {item.dueLabel ? <span className="action-board-due-chip">{item.dueLabel}</span> : null}
                            </div>
                          </div>

                          <div className="action-board-tail">
                            <span className={`action-board-priority action-board-priority--${item.priority}`}>{item.completed ? 'Done' : item.priority}</span>
                            <span className="avatar-bubble action-board-avatar">{item.assigneeInitials}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <p className="empty-copy">No action items matched that filter.</p>
              )}
            </section>
          </>
        ) : activeView === 'settings' ? (
          <>
            <header className="dashboard-header meetings-page-header">
              <div>
                <h1>Settings</h1>
                <p className="hero-copy">Manage your account, preferences, and integrations.</p>
              </div>
            </header>

            <section className="settings-page settings-layout">
              <aside className="settings-nav-panel">
                <div className="settings-nav-group">
                  <p className="settings-nav-label">Account</p>
                  <button className={`settings-nav-item${settingsSection === 'profile' ? ' settings-nav-item--active' : ''}`} type="button" onClick={() => setSettingsSection('profile')}>Profile</button>
                  <button className={`settings-nav-item${settingsSection === 'billing' ? ' settings-nav-item--active' : ''}`} type="button" onClick={() => setSettingsSection('billing')}>Plan & Billing</button>
                </div>

                <div className="settings-nav-group">
                  <p className="settings-nav-label">Preferences</p>
                  <button className={`settings-nav-item${settingsSection === 'transcription' ? ' settings-nav-item--active' : ''}`} type="button" onClick={() => setSettingsSection('transcription')}>Transcription</button>
                  <button className={`settings-nav-item${settingsSection === 'summaries' ? ' settings-nav-item--active' : ''}`} type="button" onClick={() => setSettingsSection('summaries')}>Summaries & AI</button>
                  <button className={`settings-nav-item${settingsSection === 'notifications' ? ' settings-nav-item--active' : ''}`} type="button" onClick={() => setSettingsSection('notifications')}>Notifications</button>
                </div>

                <div className="settings-nav-group">
                  <p className="settings-nav-label">Connections</p>
                  <button className={`settings-nav-item${settingsSection === 'integrations' ? ' settings-nav-item--active' : ''}`} type="button" onClick={() => setSettingsSection('integrations')}>Integrations</button>
                  <button className={`settings-nav-item${settingsSection === 'api' ? ' settings-nav-item--active' : ''}`} type="button" onClick={() => setSettingsSection('api')}>API & webhooks</button>
                </div>
              </aside>

              <div className="settings-content-panel">
                {settingsSection === 'transcription' ? (
                  <>
                    <div className="settings-content-header">
                      <h2>Transcription settings</h2>
                    </div>

                    <div className="settings-section-block">
                      <div className="settings-row settings-row--select">
                        <div>
                          <p className="settings-item-title">Transcription language</p>
                          <p className="settings-item-copy">Language used by Whisper to transcribe audio</p>
                        </div>
                        <select className="sort-select settings-select" value={transcriptionLanguage} onChange={(event) => setTranscriptionLanguage(event.target.value)}>
                          <option>English (US)</option>
                          <option>English (UK)</option>
                          <option>Spanish</option>
                          <option>French</option>
                        </select>
                      </div>

                      <div className="settings-row">
                        <div>
                          <p className="settings-item-title">Speaker diarization</p>
                          <p className="settings-item-copy">Automatically identify and label different speakers</p>
                        </div>
                        <button className={`toggle-switch${speakerDiarizationEnabled ? ' toggle-switch--on' : ''}`} type="button" onClick={() => setSpeakerDiarizationEnabled((current) => !current)} aria-pressed={speakerDiarizationEnabled}>
                          <span className="toggle-switch-knob" />
                        </button>
                      </div>

                      <div className="settings-row">
                        <div>
                          <p className="settings-item-title">Auto-punctuation</p>
                          <p className="settings-item-copy">Add punctuation and paragraph breaks automatically</p>
                        </div>
                        <button className={`toggle-switch${autoPunctuationEnabled ? ' toggle-switch--on' : ''}`} type="button" onClick={() => setAutoPunctuationEnabled((current) => !current)} aria-pressed={autoPunctuationEnabled}>
                          <span className="toggle-switch-knob" />
                        </button>
                      </div>

                      <div className="settings-row">
                        <div>
                          <p className="settings-item-title">Filter filler words</p>
                          <p className="settings-item-copy">Remove "um", "uh", "like" from transcripts</p>
                        </div>
                        <button className={`toggle-switch${filterFillerWordsEnabled ? ' toggle-switch--on' : ''}`} type="button" onClick={() => setFilterFillerWordsEnabled((current) => !current)} aria-pressed={filterFillerWordsEnabled}>
                          <span className="toggle-switch-knob" />
                        </button>
                      </div>

                      <div className="settings-row">
                        <div>
                          <p className="settings-item-title">Profanity filter</p>
                          <p className="settings-item-copy">Censor profanity in transcripts</p>
                        </div>
                        <button className={`toggle-switch${profanityFilterEnabled ? ' toggle-switch--on' : ''}`} type="button" onClick={() => setProfanityFilterEnabled((current) => !current)} aria-pressed={profanityFilterEnabled}>
                          <span className="toggle-switch-knob" />
                        </button>
                      </div>
                    </div>

                    <div className="settings-section-block">
                      <h3>Audio upload</h3>

                      <div className="settings-row settings-row--static">
                        <div>
                          <p className="settings-item-title">Accepted file types</p>
                          <p className="settings-item-copy">Formats allowed for audio upload</p>
                        </div>
                        <p className="settings-static-value">MP3, MP4, M4A, WAV, OGG</p>
                      </div>

                      <div className="settings-row settings-row--static">
                        <div>
                          <p className="settings-item-title">Max file size</p>
                          <p className="settings-item-copy">Per-upload limit on your current plan</p>
                        </div>
                        <p className="settings-static-value">500 MB</p>
                      </div>
                    </div>
                  </>
                ) : settingsSection === 'profile' ? (
                  <div className="settings-placeholder">
                    <h2>Profile</h2>
                    <p className="support-note">Profile management can be added here when account settings are wired to the backend.</p>
                  </div>
                ) : settingsSection === 'billing' ? (
                  <div className="settings-placeholder">
                    <h2>Plan & Billing</h2>
                    <p className="support-note">Billing controls are currently placeholder content for local development.</p>
                  </div>
                ) : settingsSection === 'summaries' ? (
                  <div className="settings-placeholder">
                    <h2>Summaries & AI</h2>
                    <p className="support-note">Summary and AI configuration can be added here once those settings are exposed.</p>
                  </div>
                ) : settingsSection === 'notifications' ? (
                  <div className="settings-placeholder">
                    <h2>Notifications</h2>
                    <p className="support-note">Notification preferences can be added here when delivery channels are configured.</p>
                  </div>
                ) : settingsSection === 'integrations' ? (
                  <div className="settings-placeholder">
                    <h2>Integrations</h2>
                    <p className="support-note">Third-party integrations can be configured here in a later pass.</p>
                  </div>
                ) : (
                  <div className="settings-placeholder">
                    <h2>API & webhooks</h2>
                    <p className="support-note">API keys, webhook URLs, and backend endpoints can be managed here when those flows are implemented.</p>
                    <div className="control-card settings-card">
                      <label className="field-label" htmlFor="settingsApiBaseUrl">Backend URL</label>
                      <input
                        id="settingsApiBaseUrl"
                        className="text-input"
                        value={apiBaseUrl}
                        onChange={(event) => setApiBaseUrl(event.target.value)}
                        placeholder="http://localhost:8000"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">MeetingBrief Dashboard</p>
                <h1>Good morning</h1>
                <p className="hero-copy">{formattedToday} • local recorder, transcripts, summaries, and action items in one workspace.</p>
              </div>
              <button className="hero-button" type="button" onClick={jumpToRecorder}>New Meeting</button>
            </header>

            <section className="stats-grid">
              <article className="stat-card">
                <p className="stat-label">Meetings in session</p>
                <p className="stat-value">{uploadResult ? 1 : 0}</p>
                <p className="stat-note">{uploadResult ? 'Latest meeting saved locally' : 'No meetings uploaded yet'}</p>
              </article>
              <article className="stat-card">
                <p className="stat-label">Action items pending</p>
                <p className="stat-value">{pendingActionItems.length}</p>
                <p className="stat-note">{completedActionItems} completed</p>
              </article>
              <article className="stat-card">
                <p className="stat-label">Hours recorded</p>
                <p className="stat-value">{recordedHours.toFixed(1)}</p>
                <p className="stat-note">{elapsedSeconds ? `${elapsedSeconds}s current session` : 'Recorder ready'}</p>
              </article>
              <article className="stat-card">
                <p className="stat-label">Artifacts captured</p>
                <p className="stat-value">{summaryCount + transcriptCount + actionItems.length}</p>
                <p className="stat-note">{summaryCount} summaries • {transcriptCount} transcripts</p>
              </article>
            </section>

            <section className="overview-grid">
              <section className="dashboard-panel meetings-stack">
                <div className="section-header">
                  <h2>Recent Meetings</h2>
                  <button className="link-button" type="button" onClick={() => setActiveView('meetings')}>Open meetings</button>
                </div>

                {recentMeetings.length ? (
                  <div className="meeting-card-list">
                    {recentMeetings.map((meeting) => (
                      <button className={`meeting-card meeting-card--${meeting.accent} meeting-card-button`} key={meeting.id} type="button" onClick={() => {
                        openMeetingDetails(meeting.id);
                        setActiveView('meetings');
                      }}>
                        <div className="meeting-card-head">
                          <div>
                            <h3>{meeting.title}</h3>
                            <p>{meeting.subtitle}</p>
                          </div>
                          <span className="meeting-status">{meeting.status}</span>
                        </div>
                        <div className="tag-row">
                          {meeting.tags.map((tag) => (
                            <span className="tag-chip" key={tag}>{tag}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-card">
                    <p className="empty-copy">No meetings yet. Start a recording to create your first local meeting card.</p>
                  </div>
                )}
              </section>

              <section className="dashboard-panel action-panel">
                <div className="section-header">
                  <h2>Action Items</h2>
                  <button className="link-button" type="button" onClick={() => setActiveView('action-items')}>{pendingActionItems.length} pending</button>
                </div>

                {actionItems.length ? (
                  <div className="action-item-list action-item-list--dashboard">
                    {actionItems.map((item) => (
                      <div className="action-item-row" key={item.id}>
                        <div className={`checkbox-shell${item.completed ? ' checkbox-shell--checked' : ''}`}>{item.completed ? '✓' : ''}</div>
                        <div className="action-item-copy">
                          <p className={`action-item-title${item.completed ? ' action-item-title--done' : ''}`}>{item.description}</p>
                          <p className="action-item-meta">
                            {item.owner_name || 'Unassigned'}
                            {item.due_at ? ` • Due ${new Date(item.due_at).toLocaleString()}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-card">
                    <p className="empty-copy">No action items yet. Add one after uploading a meeting.</p>
                  </div>
                )}
              </section>
            </section>

            <section className="workspace-grid" ref={recorderSectionRef}>
              <section className="dashboard-panel recorder-workspace">
                <div className="section-header">
                  <h2>Recorder Workspace</h2>
                  <span className="status-pill status-pill--soft">{recordingState}</span>
                </div>

                <div className="recorder-layout">
                  <div className="control-card">
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

                  <div className="control-card recorder-card">
                    <div className="status-row">
                      <p className="status-copy">{statusMessage}</p>
                      <span className="timer">{elapsedSeconds}s</span>
                    </div>

                    {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

                    <div className="button-row">
                      <button className="primary-button" type="button" onClick={startRecording} disabled={recordingState === 'recording' || recordingState === 'uploading' || !canRecord}>
                        Start Recording
                      </button>
                      <button className="secondary-button" type="button" onClick={stopRecording} disabled={recordingState !== 'recording'}>
                        Stop
                      </button>
                      <button className="secondary-button" type="button" onClick={uploadRecording} disabled={!audioBlob || recordingState === 'uploading'}>
                        Upload
                      </button>
                      <button className="ghost-button" type="button" onClick={resetRecording}>
                        Reset
                      </button>
                    </div>

                    {!canRecord ? (
                      <p className="support-note">MediaRecorder support was not detected in this browser. Use a recent desktop browser for local verification.</p>
                    ) : null}

                    {audioBlob ? (
                      <div className="preview-panel">
                        <p className="preview-label">Playback preview</p>
                        <audio controls src={URL.createObjectURL(audioBlob)} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="dashboard-panel response-panel">
                <div className="section-header">
                  <h2>Latest Upload</h2>
                  {uploadResult ? <span className="meeting-status">{uploadResult.status}</span> : null}
                </div>
                {uploadResult ? (
                  <dl className="result-grid">
                    <div>
                      <dt>Meeting ID</dt>
                      <dd>{uploadResult.id}</dd>
                    </div>
                    <div>
                      <dt>Title</dt>
                      <dd>{uploadResult.title ?? 'Untitled meeting'}</dd>
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
            </section>

            <section className="dashboard-panel artifacts-panel" ref={artifactsSectionRef}>
              <div className="artifacts-header">
                <div>
                  <p className="eyebrow">Artifacts</p>
                  <h2>Transcript, summary, and action items</h2>
                </div>
                {uploadResult ? <span className="status-pill status-pill--soft">Meeting ready</span> : null}
              </div>

              {!uploadResult ? (
                <p className="empty-copy">Upload a meeting first to manage transcript, summary, and action items.</p>
              ) : (
                <div className="artifact-grid">
                  <div className="artifact-card">
                    <h3>Transcript</h3>
                    <label className="field-label" htmlFor="transcriptProvider">Provider</label>
                    <input id="transcriptProvider" className="text-input" value={transcriptProvider} onChange={(event) => setTranscriptProvider(event.target.value)} placeholder="OpenAI, Anthropic, manual" />
                    <label className="field-label" htmlFor="transcriptText">Transcript text</label>
                    <textarea id="transcriptText" className="text-area artifact-textarea" value={transcriptText} onChange={(event) => setTranscriptText(event.target.value)} placeholder="Paste or edit the transcript here" rows={8} />
                    <button className="primary-button" type="button" onClick={saveTranscript} disabled={isSavingArtifacts || !transcriptText.trim()}>
                      Save Transcript
                    </button>
                  </div>

                  <div className="artifact-card">
                    <h3>Summary</h3>
                    <label className="field-label" htmlFor="summaryProvider">Provider</label>
                    <input id="summaryProvider" className="text-input" value={summaryProvider} onChange={(event) => setSummaryProvider(event.target.value)} placeholder="OpenAI, Anthropic, manual" />
                    <label className="field-label" htmlFor="summaryText">Summary text</label>
                    <textarea id="summaryText" className="text-area artifact-textarea" value={summaryText} onChange={(event) => setSummaryText(event.target.value)} placeholder="Write the meeting summary here" rows={8} />
                    <button className="primary-button" type="button" onClick={saveSummary} disabled={isSavingArtifacts || !summaryText.trim()}>
                      Save Summary
                    </button>
                  </div>

                  <div className="artifact-card artifact-card--wide">
                    <h3>Action items</h3>
                    <div className="action-item-form">
                      <input className="text-input" value={newActionItemDescription} onChange={(event) => setNewActionItemDescription(event.target.value)} placeholder="Action item description" />
                      <input className="text-input" value={newActionItemOwner} onChange={(event) => setNewActionItemOwner(event.target.value)} placeholder="Owner" />
                      <input className="text-input" type="datetime-local" value={newActionItemDueAt} onChange={(event) => setNewActionItemDueAt(event.target.value)} />
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
                              <button className="secondary-button" type="button" onClick={() => updateActionItem(item, { completed: !item.completed })} disabled={isSavingArtifacts}>
                                {item.completed ? 'Mark Open' : 'Complete'}
                              </button>
                              <button className="ghost-button" type="button" onClick={() => deleteActionItem(item.id)} disabled={isSavingArtifacts}>
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
          </>
        )}
      </section>
    </main>
  );
}

export default App;