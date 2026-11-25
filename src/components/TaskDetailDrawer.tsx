import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Diamond,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Link2,
  Paperclip,
  Pencil,
  Save,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import {
  ATTACHMENT_CATEGORY_LABELS,
  AttachmentCategory,
  Bureau,
  BUREAU_COLORS,
  FestivalTask,
  FIELD_LIMITS,
  Initiative,
  NOTE_TYPE_LABELS,
  NoteType,
  ProgressStage,
  STAGE_TONES,
  TaskAttachment,
  TaskNote,
} from '../types';
import {
  addTaskAttachment,
  addTaskNote,
  deleteTask,
  deleteTaskAttachment,
  deleteTaskNote,
  saveTask,
  subscribeToTaskAttachments,
  subscribeToTaskNotes,
  toggleTaskVerification,
  updateTaskDates,
  updateTaskQuickProgress,
} from '../services/firestoreService';
import {
  diffDays,
  formatShortJP,
  getEffectiveDeadline,
  getTodayStr,
  isDeadlineOnlyItem,
} from '../utils/dateUtils';
import { CustomSelect } from './CustomSelect';

interface TaskDetailDrawerProps {
  uid: string;
  projectId: string;
  task: FestivalTask;
  bureaus: Bureau[];
  initiatives: Initiative[];
  stages: ProgressStage[];
  userDisplayName: string;
  canEdit?: boolean;
  isBoardOwner?: boolean;
  onClose: () => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  uid,
  projectId,
  task,
  bureaus,
  initiatives,
  stages,
  userDisplayName,
  canEdit = true,
  isBoardOwner = true,
  onClose,
}) => {
  const today = getTodayStr();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit mode toggle so the default view is a clean Dashboard
  const [editingMeta, setEditingMeta] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [bureauId, setBureauId] = useState(task.bureauId);
  const [teamId, setTeamId] = useState(task.teamId);
  const [assigneeName, setAssigneeName] = useState(task.assigneeName);
  const [initiativeId, setInitiativeId] = useState(task.initiativeId || '');
  const [stageId, setStageId] = useState(task.stageId);
  const [progressPercent, setProgressPercent] = useState(task.progressPercent);
  const [startDate, setStartDate] = useState(task.startDate);
  const [endDate, setEndDate] = useState(task.endDate);
  const [deadlineDate, setDeadlineDate] = useState(task.deadlineDate || '');
  const [isMilestone, setIsMilestone] = useState(task.isMilestone);
  const [savingMeta, setSavingMeta] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachMode, setAttachMode] = useState<'file' | 'link'>('file');
  const [attCategory, setAttCategory] = useState<AttachmentCategory>('plan');
  const [attTitle, setAttTitle] = useState('');
  const [attUrl, setAttUrl] = useState('');
  const [attUploader, setAttUploader] = useState(userDisplayName || '実行委員');
  const [attError, setAttError] = useState<string | null>(null);
  const [attBusy, setAttBusy] = useState(false);

  // Notes state (Non-messaging audit log)
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [noteType, setNoteType] = useState<NoteType>('progress_check');
  const [noteContent, setNoteContent] = useState('');
  const [noteAuthor, setNoteAuthor] = useState(userDisplayName || '実行委員');
  const [noteBureau, setNoteBureau] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const [progressError, setProgressError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setBureauId(task.bureauId);
    setTeamId(task.teamId);
    setAssigneeName(task.assigneeName);
    setInitiativeId(task.initiativeId || '');
    setStageId(task.stageId || '');
    setProgressPercent(task.progressPercent);
    setStartDate(task.startDate);
    setEndDate(task.endDate);
    setDeadlineDate(task.deadlineDate || '');
    setIsMilestone(task.isMilestone);
  }, [task]);

  useEffect(() => {
    setEditingMeta(false);
    setConfirmDelete(false);
    setStatusNotice(null);
    setProgressError(null);
    setAttError(null);
  }, [task.id]);

  const noteIdsKey = (task.noteIds || []).join(',');
  const attachmentIdsKey = (task.attachmentIds || []).join(',');

  useEffect(() => {
    const unsubNotes = subscribeToTaskNotes(
      uid,
      projectId,
      task.id,
      task.noteIds || [],
      setNotes
    );
    return () => unsubNotes();
  }, [uid, projectId, task.id, noteIdsKey]);

  useEffect(() => {
    const unsubAtts = subscribeToTaskAttachments(
      uid,
      projectId,
      task.id,
      task.attachmentIds || [],
      setAttachments
    );
    return () => unsubAtts();
  }, [uid, projectId, task.id, attachmentIdsKey]);

  const flashNotice = (msg: string) => {
    setProgressError(null);
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 2000);
  };

  const currentBureau = bureaus.find((b) => b.id === task.bureauId);
  const currentTeam = currentBureau?.teams.find((t) => t.id === task.teamId);
  const parentInitiative = initiatives.find((i) => i.id === task.initiativeId);
  const resolvedStageId = stageId || '';
  const currentStage = stages.find((s) => s.id === resolvedStageId);
  const palette = BUREAU_COLORS[currentBureau?.colorKey || 'slate'] || BUREAU_COLORS.slate;
  const stageTone = currentStage ? STAGE_TONES[currentStage.tone] : STAGE_TONES.neutral;

  const effectiveDeadline = getEffectiveDeadline(task);
  const deadlineOnly = isDeadlineOnlyItem(task);
  const isLate = effectiveDeadline < today && progressPercent < 100;
  const remainingDays = diffDays(today, effectiveDeadline);

  const editBureau = bureaus.find((b) => b.id === bureauId);
  const editTeams = editBureau?.teams || [];

  const initiativeOptions = [
    { value: '', label: '（指定なし）' },
    ...initiatives.map((init) => ({
      value: init.id,
      label: init.name,
      swatchClass: (BUREAU_COLORS[init.colorKey] || BUREAU_COLORS.slate).swatch,
    })),
  ];

  const bureauOptions = bureaus.map((b) => ({
    value: b.id,
    label: b.name,
    swatchClass: (BUREAU_COLORS[b.colorKey] || BUREAU_COLORS.slate).swatch,
  }));

  const editTeamOptions = editTeams.map((tm) => ({
    value: tm.id,
    label: tm.name,
  }));

  const stageSelectOptions = stages.map((st) => {
    const tone = STAGE_TONES[st.tone] || STAGE_TONES.neutral;
    return {
      value: st.id,
      label: st.name,
      subLabel: `${st.defaultPercent}%`,
      swatchClass: tone.indicatorClass,
      textClass: tone.textClass,
    };
  });

  const optionalStageOptions = [
    { value: '', label: '（指定しない）' },
    ...stageSelectOptions,
  ];

  const attachmentCatOptions = Object.entries(ATTACHMENT_CATEGORY_LABELS).map(([k, v]) => ({
    value: k,
    label: v.label,
    textClass: v.textClass,
  }));

  const noteTypeOptions = Object.entries(NOTE_TYPE_LABELS).map(([k, v]) => ({
    value: k,
    label: v.label,
    textClass: v.textClass,
  }));

  const handleStageSelect = async (nextStage: ProgressStage) => {
    const prevStageId = stageId;
    const prevPercent = progressPercent;
    setStageId(nextStage.id);
    setProgressPercent(nextStage.defaultPercent);
    setProgressError(null);
    try {
      await updateTaskQuickProgress(projectId, task.id, nextStage.id, nextStage.defaultPercent);
      flashNotice('進捗段階を更新しました');
    } catch {
      setStageId(prevStageId);
      setProgressPercent(prevPercent);
      setProgressError('進捗段階の保存に失敗しました。');
    }
  };

  const handleSliderCommit = async (pct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    const targetStageId = currentStage ? currentStage.id : '';
    setProgressPercent(clamped);
    setProgressError(null);
    try {
      await updateTaskQuickProgress(projectId, task.id, targetStageId, clamped);
      flashNotice('進捗率を更新しました');
    } catch {
      setProgressPercent(task.progressPercent);
      setProgressError('進捗率の保存に失敗しました。');
    }
  };

  const handleToggleVerified = async () => {
    const next = !task.isVerified;
    try {
      await toggleTaskVerification(projectId, task.id, next, next ? userDisplayName : '');
      flashNotice(next ? '確認済みにしました' : '未確認に戻しました');
    } catch {
      setProgressError('確認状態の更新に失敗しました。');
    }
  };

  const handleInlineDeadlineChange = async (nextDeadline: string) => {
    const prevDeadline = deadlineDate;
    setDeadlineDate(nextDeadline);
    setProgressError(null);
    const nextStart = deadlineOnly && nextDeadline ? nextDeadline : task.startDate;
    const nextEnd = deadlineOnly && nextDeadline ? nextDeadline : task.endDate;
    try {
      await updateTaskDates(projectId, task.id, nextStart, nextEnd, nextDeadline);
      flashNotice('締め切り日を更新しました');
    } catch {
      setDeadlineDate(prevDeadline);
      setProgressError('締め切り日の保存に失敗しました。');
    }
  };

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !title.trim()) return;
    setSavingMeta(true);
    try {
      await saveTask(
        uid,
        projectId,
        {
          id: task.id,
          title,
          description,
          bureauId,
          teamId,
          assigneeName,
          initiativeId: isBoardOwner ? initiativeId : task.initiativeId || '',
          previousInitiativeId: task.initiativeId || '',
          stageId,
          progressPercent,
          startDate,
          endDate: endDate >= startDate ? endDate : startDate,
          deadlineDate,
          isMilestone,
          isVerified: task.isVerified,
          verifiedBy: task.verifiedBy,
        },
        false
      );
      setEditingMeta(false);
      flashNotice('基本情報を保存しました');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!canEdit) return;
    await deleteTask(projectId, task.id, task.initiativeId);
    onClose();
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setAttError(null);

    if (file.size > FIELD_LIMITS.ATTACHMENT_FILE_MAX_BYTES) {
      setAttError(
        `ファイルサイズが大きすぎます（上限 500KB / 現在 ${Math.round(file.size / 1024)}KB）。大容量の資料は「リンク・URL添付」をご利用ください。`
      );
      return;
    }

    setAttBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
        reader.readAsDataURL(file);
      });

      if (!dataUrl || dataUrl.length > FIELD_LIMITS.ATTACHMENT_DATAURL_MAX) {
        setAttError(
          'エンコード後のデータサイズが上限を超えました。リンクURLでの添付をご利用ください。'
        );
        return;
      }

      await addTaskAttachment(uid, projectId, task.id, {
        title: attTitle.trim() || file.name,
        kind: 'file',
        category: attCategory,
        url: '',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        dataUrl,
        uploadedBy: attUploader,
      });

      setAttTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      flashNotice('資料ファイルを添付しました');
    } catch (err) {
      setAttError(err instanceof Error ? err.message : 'ファイル添付に失敗しました');
    } finally {
      setAttBusy(false);
    }
  };

  const handleAddLinkAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = attUrl.trim();
    if (!trimmedUrl) return;
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setAttError('URLは https:// または http:// から始まる形式で入力してください。');
      return;
    }

    setAttBusy(true);
    setAttError(null);
    try {
      await addTaskAttachment(uid, projectId, task.id, {
        title: attTitle.trim() || trimmedUrl,
        kind: 'link',
        category: attCategory,
        url: trimmedUrl,
        fileName: '',
        mimeType: '',
        fileSize: 0,
        dataUrl: '',
        uploadedBy: attUploader,
      });
      setAttTitle('');
      setAttUrl('');
      flashNotice('資料リンクを添付しました');
    } catch (err) {
      setAttError(err instanceof Error ? err.message : 'リンクの登録に失敗しました');
    } finally {
      setAttBusy(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setAddingNote(true);
    try {
      await addTaskNote(uid, projectId, task.id, {
        noteType,
        content: noteContent,
        authorName: noteAuthor,
        authorBureau: noteBureau || currentBureau?.name || '',
      });
      setNoteContent('');
    } finally {
      setAddingNote(false);
    }
  };

  const formatTimestamp = (ts?: TaskAttachment['createdAt']) => {
    if (!ts || typeof ts.toDate !== 'function') return 'たった今';
    const d = ts.toDate();
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/35"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="タスク確認ダッシュボード"
    >
      <div
        className="w-full max-w-3xl bg-white h-full border-l border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dashboard Top Bar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${palette.swatch}`} />
              <span className="font-semibold text-slate-800">{currentBureau?.name || '局未設定'}</span>
              {currentTeam && (
                <>
                  <span className="text-slate-300" aria-hidden="true">
                    /
                  </span>
                  <span>{currentTeam.name}</span>
                </>
              )}
              {parentInitiative && (
                <>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-600 truncate max-w-xs">
                    <FolderKanban className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{parentInitiative.name}</span>
                  </span>
                </>
              )}
              {statusNotice && (
                <span className="text-emerald-700 font-semibold ml-1">{statusNotice}</span>
              )}
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              {task.isMilestone && (
                <Diamond
                  className="w-4 h-4 text-blue-700 fill-blue-100 shrink-0"
                  aria-label="重要マイルストーン"
                />
              )}
              <h2 className="text-base font-bold text-slate-900 leading-snug">{task.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEdit ? (
              <>
                <button
                  type="button"
                  onClick={handleToggleVerified}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    task.isVerified
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {task.isVerified ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>確認済</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-3.5 h-3.5 text-slate-400" />
                      <span>確認済にする</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setEditingMeta((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    editingMeta
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{editingMeta ? '編集を閉じる' : '基本編集'}</span>
                </button>
              </>
            ) : (
              <span className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-600 whitespace-nowrap">
                {task.isVerified ? '確認済 · 閲覧のみ' : '閲覧のみ'}
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Optional Inline Basic Info Editor (Collapsed by default so Dashboard stays front-and-center) */}
          {canEdit && editingMeta && (
            <form
              onSubmit={handleSaveMeta}
              className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900">タスク基本情報の編集</h3>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>タスクを削除</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteTask}
                      className="px-2.5 py-1 bg-red-600 text-white text-xs font-semibold rounded cursor-pointer"
                    >
                      本当に削除する
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 bg-white border border-slate-200 text-xs text-slate-600 rounded cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  タスク名
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.TASK_TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    所属プロジェクト
                  </label>
                  {isBoardOwner ? (
                    <CustomSelect
                      value={initiativeId}
                      options={initiativeOptions}
                      onChange={setInitiativeId}
                      ariaLabel="所属プロジェクト"
                      className="w-full"
                    />
                  ) : (
                    <div className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 truncate">
                      {parentInitiative?.name || '共有プロジェクト'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    担当局
                  </label>
                  <CustomSelect
                    value={bureauId}
                    options={bureauOptions}
                    onChange={(bId) => {
                      setBureauId(bId);
                      const nextB = bureaus.find((b) => b.id === bId);
                      setTeamId(nextB?.teams[0]?.id || '');
                    }}
                    ariaLabel="担当局"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    担当
                  </label>
                  <CustomSelect
                    value={teamId}
                    options={editTeamOptions}
                    onChange={setTeamId}
                    ariaLabel="担当"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    担当者名
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.ASSIGNEE_MAX}
                    value={assigneeName}
                    onChange={(e) => setAssigneeName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    開始日
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    終了予定日
                  </label>
                  <input
                    type="date"
                    required
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    締め切り日（任意）
                  </label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                  />
                </div>
                <label className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMilestone}
                    onChange={(e) => setIsMilestone(e.target.checked)}
                    className="accent-blue-700"
                  />
                  <span>重要日程</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    進捗段階（任意）
                  </label>
                  <CustomSelect
                    value={currentStage ? resolvedStageId : ''}
                    options={optionalStageOptions}
                    onChange={(nextVal) => {
                      setStageId(nextVal);
                      const st = stages.find((s) => s.id === nextVal);
                      if (st) setProgressPercent(st.defaultPercent);
                    }}
                    ariaLabel="進捗段階"
                    placeholder="（指定しない）"
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-600">進捗率</label>
                    <span className="text-xs font-mono tabular-nums font-bold text-slate-800">
                      {progressPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(parseInt(e.target.value, 10))}
                    className="w-full accent-blue-700 cursor-pointer mt-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  概要・完了条件
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.TASK_DESC_MAX}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingMeta}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingMeta ? '保存中...' : '基本情報を保存'}</span>
                </button>
              </div>
            </form>
          )}

          {progressError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {progressError}
            </div>
          )}

          {/* Top Dashboard Summary Grid (3 Flat Cells with Hairline Dividers) */}
          <div className="grid grid-cols-1 md:grid-cols-3 border border-slate-200 rounded-xl divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {/* Progress Metric & Slider */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">進捗状況</span>
                {canEdit ? (
                  <CustomSelect
                    value={currentStage ? resolvedStageId : ''}
                    options={stageSelectOptions}
                    onChange={(nextVal) => {
                      const nextStage = stages.find((s) => s.id === nextVal);
                      if (nextStage) handleStageSelect(nextStage);
                    }}
                    placeholder="段階未設定"
                    ariaLabel="進捗段階を選択"
                    size="xs"
                    align="right"
                    className="max-w-[148px]"
                    textClassName={currentStage ? `font-semibold ${stageTone.textClass}` : 'text-slate-500'}
                  />
                ) : (
                  <span
                    className={`text-xs font-semibold ${
                      currentStage ? stageTone.textClass : 'text-slate-500'
                    }`}
                  >
                    {currentStage ? currentStage.name : '段階未設定'}
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {progressPercent}%
                </span>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    {[0, 25, 50, 75, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSliderCommit(preset)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums border cursor-pointer transition-colors ${
                          progressPercent === preset
                            ? 'bg-blue-50 border-blue-400 text-blue-800 font-bold'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {canEdit ? (
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progressPercent}
                  onChange={(e) => setProgressPercent(parseInt(e.target.value, 10))}
                  onPointerUp={(e) =>
                    handleSliderCommit(parseInt((e.target as HTMLInputElement).value, 10))
                  }
                  onKeyUp={(e) =>
                    handleSliderCommit(parseInt((e.target as HTMLInputElement).value, 10))
                  }
                  aria-label="進捗率調整"
                  className="w-full accent-blue-700 cursor-pointer"
                />
              ) : (
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>

            {/* Schedule & Deadline */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>実施期間・締め切り日</span>
                </span>
                {deadlineOnly && (
                  <span className="text-[10px] font-semibold text-red-700">単日〆</span>
                )}
              </div>
              <p className="text-sm font-bold font-mono tabular-nums text-slate-900">
                {deadlineOnly
                  ? `〆 ${formatShortJP(effectiveDeadline)}`
                  : `${formatShortJP(task.startDate)} 〜 ${formatShortJP(task.endDate)}`}
              </p>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-medium text-slate-500 shrink-0">〆 締切</label>
                {canEdit ? (
                  <>
                    <input
                      type="date"
                      value={deadlineDate || task.endDate}
                      onChange={(e) => handleInlineDeadlineChange(e.target.value)}
                      aria-label="締め切り日を変更"
                      className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono tabular-nums text-slate-800 w-[124px]"
                    />
                    {deadlineDate && !deadlineOnly && deadlineDate !== task.endDate && (
                      <button
                        type="button"
                        onClick={() => handleInlineDeadlineChange('')}
                        title="終了予定日と同じ締切に戻す"
                        className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer shrink-0"
                      >
                        自動
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-xs font-mono tabular-nums text-slate-700">
                    {formatShortJP(effectiveDeadline)}
                  </span>
                )}
              </div>
              <p
                className={`text-xs font-medium ${
                  isLate
                    ? 'text-red-600'
                    : remainingDays <= 3 && progressPercent < 100
                      ? 'text-amber-700'
                      : 'text-slate-600'
                }`}
              >
                {progressPercent >= 100
                  ? '完了済み'
                  : isLate
                    ? `締切を ${Math.abs(remainingDays)}日 超過`
                    : remainingDays === 0
                      ? '本日が締め切り日です'
                      : `締切まであと ${remainingDays}日`}
              </p>
            </div>

            {/* Assignee & Verification */}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>担当者 · 確認状態</span>
              </div>
              <p className="text-sm font-bold text-slate-900 truncate">
                {task.assigneeName || '担当者 未割当'}
              </p>
              <p className="text-xs text-slate-600 truncate">
                {task.isVerified
                  ? `確認済み${task.verifiedBy ? `（${task.verifiedBy}）` : ''}`
                  : '未確認（確認待ち）'}
              </p>
            </div>
          </div>

          {/* Task Scope Description (if present) */}
          {task.description && (
            <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">業務内容・完了条件</p>
              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Quick Stage Switcher */}
          {canEdit && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">進捗段階を切り替え</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {stages.map((st) => {
                  const selected = st.id === resolvedStageId;
                  const tone = STAGE_TONES[st.tone] || STAGE_TONES.neutral;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleStageSelect(st)}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-blue-50 border-blue-600 text-blue-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs truncate">{st.name}</span>
                        <span className="text-[10px] font-mono tabular-nums text-slate-500">
                          {st.defaultPercent}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full w-full ${tone.barClass} opacity-80`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PRIMARY FEATURE: On-the-spot Document & Material Attachments Dashboard */}
          <div className="pt-5 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-700" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900">
                  資料・ファイル添付 ({attachments.length}件)
                </h3>
              </div>

              {canEdit && (
                <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setAttachMode('file');
                      setAttError(null);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      attachMode === 'file'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-3 h-3" aria-hidden="true" />
                    <span>ファイルを添付</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachMode('link');
                      setAttError(null);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      attachMode === 'link'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Link2 className="w-3 h-3" aria-hidden="true" />
                    <span>リンクURLを添付</span>
                  </button>
                </div>
              )}
            </div>

            {/* Upload / Link Form */}
            {canEdit && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              {attError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {attError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    資料カテゴリ
                  </label>
                  <CustomSelect
                    value={attCategory}
                    options={attachmentCatOptions}
                    onChange={(v) => setAttCategory(v as AttachmentCategory)}
                    ariaLabel="資料カテゴリ"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    資料タイトル（任意）
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.ATTACHMENT_TITLE_MAX}
                    value={attTitle}
                    onChange={(e) => setAttTitle(e.target.value)}
                    placeholder={
                      attachMode === 'file'
                        ? '空欄時はファイル名を使用'
                        : '例: ステージ配置図 第2版'
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    登録者名
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.AUTHOR_NAME_MAX}
                    value={attUploader}
                    onChange={(e) => setAttUploader(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
              </div>

              {attachMode === 'file' ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFileUpload(e.dataTransfer.files);
                  }}
                  className="p-4 bg-white border border-dashed border-slate-300 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3"
                >
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">
                      PDF・画像・Excel・Word・CSV などをここにドロップ、または選択
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      1ファイルあたり 500KB まで直接保存できます（大容量は「リンクURLを添付」推奨）
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{attBusy ? '保存中...' : 'ファイルを選択'}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      disabled={attBusy}
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="sr-only"
                    />
                  </label>
                </div>
              ) : (
                <form onSubmit={handleAddLinkAttachment} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    required
                    maxLength={FIELD_LIMITS.ATTACHMENT_URL_MAX}
                    value={attUrl}
                    onChange={(e) => setAttUrl(e.target.value)}
                    placeholder="https://docs.google.com/... や共有資料のURLを貼り付け"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                  <button
                    type="submit"
                    disabled={attBusy || !attUrl.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{attBusy ? '追加中...' : 'リンクを添付'}</span>
                  </button>
                </form>
              )}
            </div>
            )}

            {/* Attached Materials List */}
            <div className="mt-3 divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
              {attachments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  まだ添付資料はありません。上のフォームから企画書・図面・見積書などをその場で添付できます。
                </div>
              ) : (
                attachments.map((att) => {
                  const cat =
                    ATTACHMENT_CATEGORY_LABELS[att.category] ||
                    ATTACHMENT_CATEGORY_LABELS.reference;
                  const isImage = att.kind === 'file' && att.mimeType.startsWith('image/');

                  return (
                    <div key={att.id} className="p-3.5 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        {isImage && att.dataUrl ? (
                          <img
                            src={att.dataUrl}
                            alt={att.title}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                            {att.kind === 'link' ? (
                              <Link2 className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <FileText className="w-4 h-4" aria-hidden="true" />
                            )}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className={`font-semibold ${cat.textClass}`}>{cat.label}</span>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-slate-600">{att.uploadedBy}</span>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono tabular-nums text-slate-400">
                              {formatTimestamp(att.createdAt)}
                            </span>
                            {att.kind === 'file' && att.fileSize > 0 && (
                              <>
                                <span className="text-slate-300" aria-hidden="true">
                                  ·
                                </span>
                                <span className="font-mono tabular-nums text-slate-400">
                                  {formatBytes(att.fileSize)}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-slate-900 truncate">
                            {att.title}
                          </p>
                          {att.kind === 'link' && att.url && (
                            <p className="text-[11px] text-slate-500 truncate">{att.url}</p>
                          )}
                          {att.kind === 'file' && att.fileName && att.fileName !== att.title && (
                            <p className="text-[11px] text-slate-500 truncate">{att.fileName}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {att.kind === 'link' && att.url && (
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                          >
                            <span>開く</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                        )}
                        {att.kind === 'file' && att.dataUrl && (
                          <a
                            href={att.dataUrl}
                            download={att.fileName || att.title}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            <Download className="w-3 h-3" aria-hidden="true" />
                            <span>ダウンロード</span>
                          </a>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => deleteTaskAttachment(projectId, task.id, att.id)}
                            aria-label={`${att.title}を削除`}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Non-Messaging Verification Notes Section */}
          <div className="pt-5 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-slate-700" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">確認用コメント・進捗記録</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              連絡やチャットのための欄ではありません。確認結果・承認事項・仕様変更の記録を残すために使用してください。
            </p>

            {canEdit && (
              <form
                onSubmit={handleAddNote}
                className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      記録種別
                    </label>
                    <CustomSelect
                      value={noteType}
                      options={noteTypeOptions}
                      onChange={(v) => setNoteType(v as NoteType)}
                      ariaLabel="記録種別"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      記録者名
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={FIELD_LIMITS.AUTHOR_NAME_MAX}
                      value={noteAuthor}
                      onChange={(e) => setNoteAuthor(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      所属局
                    </label>
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.AUTHOR_BUREAU_MAX}
                      value={noteBureau}
                      onChange={(e) => setNoteBureau(e.target.value)}
                      placeholder={currentBureau?.name || '例: 総務局'}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                </div>

                <textarea
                  rows={2}
                  required
                  maxLength={FIELD_LIMITS.NOTE_CONTENT_MAX}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="確認した内容、残課題、承認条件などを簡潔に記録してください..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingNote || !noteContent.trim()}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {addingNote ? '記録中...' : '確認コメントを追加'}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-3 divide-y divide-slate-200">
              {notes.length === 0 ? (
                <p className="py-5 text-center text-xs text-slate-500">
                  まだ確認コメントはありません。
                </p>
              ) : (
                notes.map((n) => {
                  const meta = NOTE_TYPE_LABELS[n.noteType] || NOTE_TYPE_LABELS.progress_check;
                  return (
                    <div key={n.id} className="py-3">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-semibold ${meta.textClass}`}>{meta.label}</span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-medium text-slate-800 truncate">
                            {n.authorName}
                          </span>
                          {n.authorBureau && (
                            <>
                              <span className="text-slate-300" aria-hidden="true">
                                /
                              </span>
                              <span className="text-slate-500 truncate">{n.authorBureau}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono tabular-nums text-slate-400">
                            {formatTimestamp(n.createdAt)}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => deleteTaskNote(projectId, task.id, n.id)}
                              aria-label="記録を削除"
                              className="text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {n.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
