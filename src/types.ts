import { Timestamp } from 'firebase/firestore';

export type ColorKey =
  | 'indigo'
  | 'teal'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'sky'
  | 'emerald'
  | 'slate';

export type StageTone =
  | 'neutral'
  | 'info'
  | 'progress'
  | 'review'
  | 'approval'
  | 'done';

export type NoteType =
  | 'progress_check'
  | 'approval_memo'
  | 'change_log'
  | 'pending_verify';

export type AttachmentKind = 'file' | 'link';

export type AttachmentCategory =
  | 'plan'
  | 'budget'
  | 'layout'
  | 'permit'
  | 'reference';

export type ViewMode = 'dashboard' | 'gantt' | 'calendar' | 'list';

export type ShareRole = 'owner' | 'editor' | 'viewer';
export type InviteAccessRole = 'editor' | 'viewer';
export type InviteType = 'email' | 'link';
export type InviteStatus = 'active' | 'revoked';
export type PublicLinkRole = 'none' | 'viewer' | 'editor';
export type PublicEntryScope = 'board' | 'selected';
export type PublicEntryStatus = 'active' | 'paused';

export interface TeamItem {
  id: string;
  name: string;
}

export interface TeamRef {
  bureauId: string;
  teamId: string;
}

export interface Project {
  id: string;
  name: string;
  festivalDate: string; // YYYY-MM-DD
  festivalEndDate: string; // YYYY-MM-DD
  description: string;
  ownerId: string;
  isShared?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Bureau {
  id: string;
  name: string;
  shortName: string;
  colorKey: ColorKey;
  order: number;
  teams: TeamItem[];
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Initiative {
  id: string;
  name: string;
  description: string;
  colorKey: ColorKey;
  teamRefs: TeamRef[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  deadlineDate?: string; // YYYY-MM-DD (optional explicit deadline)
  stageId?: string;
  progressPercent?: number;
  isMilestone?: boolean;
  isVerified?: boolean;
  verifiedBy?: string;
  taskIds?: string[];
  noteIds?: string[];
  publicLinkRole?: PublicLinkRole;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProgressStage {
  id: string;
  name: string;
  order: number;
  defaultPercent: number;
  tone: StageTone;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FestivalTask {
  id: string;
  title: string;
  description: string;
  bureauId: string;
  teamId: string;
  assigneeName: string;
  initiativeId?: string;
  stageId: string;
  progressPercent: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  deadlineDate?: string; // YYYY-MM-DD (optional explicit deadline)
  isMilestone: boolean;
  isVerified: boolean;
  verifiedBy: string;
  status: 'active' | 'archived';
  noteIds?: string[];
  attachmentIds?: string[];
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TaskNote {
  id: string;
  noteType: NoteType;
  content: string;
  authorName: string;
  authorBureau: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface TaskAttachment {
  id: string;
  title: string;
  kind: AttachmentKind;
  category: AttachmentCategory;
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  dataUrl: string;
  uploadedBy: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface WorkspaceSharedConfig {
  projectName: string;
  festivalDate: string;
  festivalEndDate: string;
  description: string;
  bureaus: {
    id: string;
    name: string;
    shortName: string;
    colorKey: ColorKey;
    order: number;
    teams: TeamItem[];
  }[];
  stages: {
    id: string;
    name: string;
    order: number;
    defaultPercent: number;
    tone: StageTone;
  }[];
  hasActiveLinkShare?: boolean;
  unassignedTaskIds?: string[];
  ownerId: string;
  updatedAt?: Timestamp;
}

export interface PublicEntry {
  id: string;
  projectId: string;
  projectName: string;
  status: PublicEntryStatus;
  accessScope: PublicEntryScope;
  role: InviteAccessRole;
  initiativeIds: string[];
  ownerName: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProjectInvite {
  id: string;
  projectId: string;
  projectName: string;
  initiativeId: string;
  initiativeName: string;
  inviteType: InviteType;
  invitedEmail: string;
  role: InviteAccessRole;
  status: InviteStatus;
  ownerName: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface InitiativeMember {
  id: string;
  uid: string;
  displayName: string;
  role: InviteAccessRole;
  inviteId: string;
  projectId: string;
  initiativeId: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BoardCollaborator {
  uid: string;
  projectId: string;
  initiativeId: string;
  inviteId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface JoinedInitiative {
  id: string;
  uid: string;
  projectId: string;
  projectName: string;
  initiativeId: string;
  initiativeName: string;
  role: InviteAccessRole;
  ownerId: string;
  createdAt?: Timestamp;
}

export const FIELD_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/,
  PROJECT_NAME_MAX: 100,
  PROJECT_DESC_MAX: 500,
  INITIATIVE_NAME_MAX: 100,
  INITIATIVE_DESC_MAX: 500,
  MAX_TEAM_REFS_PER_INITIATIVE: 30,
  BUREAU_NAME_MAX: 60,
  BUREAU_SHORT_MAX: 16,
  TEAM_NAME_MAX: 60,
  MAX_TEAMS_PER_BUREAU: 20,
  STAGE_NAME_MAX: 40,
  TASK_TITLE_MAX: 120,
  TASK_DESC_MAX: 1000,
  ASSIGNEE_MAX: 60,
  VERIFIED_BY_MAX: 60,
  NOTE_CONTENT_MAX: 600,
  AUTHOR_NAME_MAX: 60,
  AUTHOR_BUREAU_MAX: 60,
  ATTACHMENT_TITLE_MAX: 120,
  ATTACHMENT_URL_MAX: 1000,
  ATTACHMENT_FILENAME_MAX: 180,
  ATTACHMENT_MIME_MAX: 120,
  ATTACHMENT_FILE_MAX_BYTES: 500000,
  ATTACHMENT_DATAURL_MAX: 750000,
  INVITE_EMAIL_MAX: 160,
  MAX_TASK_IDS: 150,
  MAX_NOTE_IDS: 100,
  MAX_ATTACHMENT_IDS: 50,
  MAX_SHARED_BUREAUS: 30,
  MAX_SHARED_STAGES: 20,
  MAX_PUBLIC_INITIATIVE_IDS: 100,
} as const;

export const BUREAU_COLORS: Record<
  ColorKey,
  {
    label: string;
    swatch: string;
    barBg: string;
    barFill: string;
    softBg: string;
    border: string;
    text: string;
  }
> = {
  indigo: {
    label: '藍 (Indigo)',
    swatch: 'bg-indigo-600',
    barBg: 'bg-indigo-100 border-indigo-300',
    barFill: 'bg-indigo-600',
    softBg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-800',
  },
  teal: {
    label: '青緑 (Teal)',
    swatch: 'bg-teal-600',
    barBg: 'bg-teal-100 border-teal-300',
    barFill: 'bg-teal-600',
    softBg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-800',
  },
  amber: {
    label: '琥珀 (Amber)',
    swatch: 'bg-amber-600',
    barBg: 'bg-amber-100 border-amber-300',
    barFill: 'bg-amber-600',
    softBg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
  },
  rose: {
    label: '紅 (Rose)',
    swatch: 'bg-rose-600',
    barBg: 'bg-rose-100 border-rose-300',
    barFill: 'bg-rose-600',
    softBg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-800',
  },
  violet: {
    label: '紫 (Violet)',
    swatch: 'bg-violet-600',
    barBg: 'bg-violet-100 border-violet-300',
    barFill: 'bg-violet-600',
    softBg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-800',
  },
  sky: {
    label: '空 (Sky)',
    swatch: 'bg-sky-600',
    barBg: 'bg-sky-100 border-sky-300',
    barFill: 'bg-sky-600',
    softBg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-800',
  },
  emerald: {
    label: '翠 (Emerald)',
    swatch: 'bg-emerald-600',
    barBg: 'bg-emerald-100 border-emerald-300',
    barFill: 'bg-emerald-600',
    softBg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
  },
  slate: {
    label: '墨 (Slate)',
    swatch: 'bg-slate-600',
    barBg: 'bg-slate-200 border-slate-300',
    barFill: 'bg-slate-600',
    softBg: 'bg-slate-100',
    border: 'border-slate-300',
    text: 'text-slate-800',
  },
};

export const STAGE_TONES: Record<
  StageTone,
  {
    label: string;
    barClass: string;
    textClass: string;
    indicatorClass: string;
  }
> = {
  neutral: {
    label: '未着手・待機',
    barClass: 'bg-slate-400',
    textClass: 'text-slate-600',
    indicatorClass: 'bg-slate-300',
  },
  info: {
    label: '企画・準備段階',
    barClass: 'bg-sky-500',
    textClass: 'text-sky-700',
    indicatorClass: 'bg-sky-500',
  },
  progress: {
    label: '実作業・制作中',
    barClass: 'bg-blue-600',
    textClass: 'text-blue-700',
    indicatorClass: 'bg-blue-600',
  },
  review: {
    label: '局内確認・レビュー',
    barClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    indicatorClass: 'bg-amber-500',
  },
  approval: {
    label: '総務・最終承認待ち',
    barClass: 'bg-violet-600',
    textClass: 'text-violet-700',
    indicatorClass: 'bg-violet-600',
  },
  done: {
    label: '完了',
    barClass: 'bg-emerald-600',
    textClass: 'text-emerald-700',
    indicatorClass: 'bg-emerald-600',
  },
};

export const NOTE_TYPE_LABELS: Record<NoteType, { label: string; textClass: string }> = {
  progress_check: { label: '進捗確認', textClass: 'text-blue-700' },
  approval_memo: { label: '確認・承認記録', textClass: 'text-emerald-700' },
  change_log: { label: '日程・仕様変更', textClass: 'text-slate-700' },
  pending_verify: { label: '要確認事項', textClass: 'text-amber-700' },
};

export const ATTACHMENT_CATEGORY_LABELS: Record<
  AttachmentCategory,
  { label: string; textClass: string }
> = {
  plan: { label: '企画書・台本', textClass: 'text-blue-700' },
  budget: { label: '予算・見積', textClass: 'text-emerald-700' },
  layout: { label: '配置図・図面', textClass: 'text-violet-700' },
  permit: { label: '申請・許可書', textClass: 'text-amber-700' },
  reference: { label: '参考資料・その他', textClass: 'text-slate-700' },
};
