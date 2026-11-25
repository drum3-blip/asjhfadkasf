import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Diamond,
  ListChecks,
  LogOut,
  Plus,
  Save,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  Bureau,
  BUREAU_COLORS,
  ColorKey,
  FestivalTask,
  FIELD_LIMITS,
  Initiative,
  NOTE_TYPE_LABELS,
  NoteType,
  ProgressStage,
  ShareRole,
  STAGE_TONES,
  TaskNote,
  TeamRef,
} from '../types';
import {
  addInitiativeNote,
  deleteInitiative,
  deleteInitiativeNote,
  saveInitiative,
  subscribeToInitiativeNotes,
} from '../services/firestoreService';
import { formatShortJP, getEffectiveDeadline, isDeadlineOnlyItem } from '../utils/dateUtils';
import { CustomSelect } from './CustomSelect';

interface InitiativeDetailDrawerProps {
  uid: string;
  projectId: string;
  initiative: Initiative;
  role: ShareRole;
  bureaus: Bureau[];
  stages: ProgressStage[];
  tasks: FestivalTask[];
  userDisplayName: string;
  onSelectTask: (task: FestivalTask) => void;
  onAddTaskForInitiative: (initiativeId: string, bureauId?: string, teamId?: string) => void;
  onQuickUpdateTaskProgress: (
    taskId: string,
    stageId: string,
    progressPercent: number
  ) => Promise<void>;
  onShareInitiative?: () => void;
  onLeaveInitiative?: () => Promise<void> | void;
  onClose: () => void;
}

export const InitiativeDetailDrawer: React.FC<InitiativeDetailDrawerProps> = ({
  uid,
  projectId,
  initiative,
  role,
  bureaus,
  stages,
  tasks,
  userDisplayName,
  onSelectTask,
  onAddTaskForInitiative,
  onQuickUpdateTaskProgress,
  onShareInitiative,
  onLeaveInitiative,
  onClose,
}) => {
  const isOwner = role === 'owner';
  const canEdit = role === 'owner' || role === 'editor';
  const [name, setName] = useState(initiative.name);
  const [description, setDescription] = useState(initiative.description);
  const [colorKey, setColorKey] = useState<ColorKey>(initiative.colorKey);
  const [startDate, setStartDate] = useState(initiative.startDate);
  const [endDate, setEndDate] = useState(initiative.endDate);
  const [deadlineDate, setDeadlineDate] = useState(initiative.deadlineDate || '');
  const [stageId, setStageId] = useState(initiative.stageId || stages[0]?.id || '');
  const [progressPercent, setProgressPercent] = useState(initiative.progressPercent ?? 0);
  const [isMilestone, setIsMilestone] = useState(Boolean(initiative.isMilestone));
  const [isVerified, setIsVerified] = useState(Boolean(initiative.isVerified));
  const [verifiedBy, setVerifiedBy] = useState(initiative.verifiedBy || userDisplayName);
  const [teamRefs, setTeamRefs] = useState<TeamRef[]>(initiative.teamRefs || []);

  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Notes (Non-messaging verification log)
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [noteType, setNoteType] = useState<NoteType>('progress_check');
  const [noteContent, setNoteContent] = useState('');
  const [noteAuthor, setNoteAuthor] = useState(userDisplayName || '実行委員');
  const [noteBureau, setNoteBureau] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    setName(initiative.name);
    setDescription(initiative.description);
    setColorKey(initiative.colorKey);
    setStartDate(initiative.startDate);
    setEndDate(initiative.endDate);
    setDeadlineDate(initiative.deadlineDate || '');
    setStageId(initiative.stageId || stages[0]?.id || '');
    setProgressPercent(initiative.progressPercent ?? 0);
    setIsMilestone(Boolean(initiative.isMilestone));
    setIsVerified(Boolean(initiative.isVerified));
    setVerifiedBy(initiative.verifiedBy || userDisplayName);
    setTeamRefs(initiative.teamRefs || []);
    setConfirmDelete(false);
    setConfirmLeave(false);
    setSaveNotice(null);
  }, [initiative, stages, userDisplayName]);

  const noteIdsKey = (initiative.noteIds || []).join(',');
  useEffect(() => {
    const unsub = subscribeToInitiativeNotes(
      uid,
      projectId,
      initiative.id,
      initiative.noteIds || [],
      setNotes
    );
    return () => unsub();
  }, [uid, projectId, initiative.id, noteIdsKey]);

  const projectTasks = tasks.filter(
    (t) => t.status === 'active' && t.initiativeId === initiative.id
  );
  const bureauById = new Map(bureaus.map((b) => [b.id, b]));
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const stageSelectOptions = stages.map((s) => {
    const tone = STAGE_TONES[s.tone] || STAGE_TONES.neutral;
    return {
      value: s.id,
      label: s.name,
      subLabel: `${s.defaultPercent}%`,
      swatchClass: tone.indicatorClass,
      textClass: tone.textClass,
    };
  });

  const colorOptions = Object.entries(BUREAU_COLORS).map(([k, v]) => ({
    value: k,
    label: v.label,
    swatchClass: v.swatch,
  }));

  const noteTypeOptions = Object.entries(NOTE_TYPE_LABELS).map(([k, v]) => ({
    value: k,
    label: v.label,
    textClass: v.textClass,
  }));

  const resolveTeamLabel = (bId: string, tId: string) => {
    const b = bureauById.get(bId);
    const tm = b?.teams.find((item) => item.id === tId);
    if (!b) return '未分類';
    return tm ? `${b.shortName}/${tm.name}` : b.name;
  };

  const isSelectedTeam = (bId: string, tId: string) =>
    teamRefs.some((r) => r.bureauId === bId && r.teamId === tId);

  const toggleTeamRef = (bId: string, tId: string) => {
    setTeamRefs((prev) => {
      const exists = prev.some((r) => r.bureauId === bId && r.teamId === tId);
      if (exists) {
        return prev.filter((r) => !(r.bureauId === bId && r.teamId === tId));
      }
      if (prev.length >= FIELD_LIMITS.MAX_TEAM_REFS_PER_INITIATIVE) return prev;
      return [...prev, { bureauId: bId, teamId: tId }];
    });
  };

  const handleStageSelect = (nextStage: ProgressStage) => {
    setStageId(nextStage.id);
    setProgressPercent(nextStage.defaultPercent);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !name.trim()) return;
    setSaving(true);
    setSaveNotice(null);
    try {
      await saveInitiative(
        uid,
        projectId,
        {
          id: initiative.id,
          name,
          description,
          colorKey,
          teamRefs,
          startDate,
          endDate: endDate >= startDate ? endDate : startDate,
          deadlineDate,
          stageId,
          progressPercent,
          isMilestone,
          isVerified,
          verifiedBy: isVerified ? verifiedBy || userDisplayName : '',
        },
        false
      );
      setSaveNotice('保存しました');
      setTimeout(() => setSaveNotice(null), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setAddingNote(true);
    try {
      await addInitiativeNote(uid, projectId, initiative.id, {
        noteType,
        content: noteContent,
        authorName: noteAuthor,
        authorBureau: noteBureau,
      });
      setNoteContent('');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDelete = async () => {
    await deleteInitiative(projectId, initiative.id);
    onClose();
  };

  const formatNoteDate = (ts?: TaskNote['createdAt']) => {
    if (!ts || typeof ts.toDate !== 'function') return 'たった今';
    const d = ts.toDate();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${day} ${hh}:${mm}`;
  };

  const handleLeave = async () => {
    if (!onLeaveInitiative) return;
    setLeaving(true);
    try {
      await onLeaveInitiative();
      onClose();
    } finally {
      setLeaving(false);
    }
  };

  const palette = BUREAU_COLORS[colorKey] || BUREAU_COLORS.slate;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-900/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="プロジェクト詳細と担当別タスク"
    >
      <div
        className="w-full max-w-2xl bg-white h-full border-l border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${palette.swatch}`} />
            <span className="text-xs font-semibold text-slate-600 truncate">
              プロジェクト詳細 · 担当 {teamRefs.length}組 · タスク {projectTasks.length}件
            </span>
            {!isOwner && (
              <span className="text-[11px] font-semibold text-blue-700 shrink-0">
                · {role === 'editor' ? '共有（共同編集）' : '共有（閲覧のみ）'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && onShareInitiative && (
              <button
                type="button"
                onClick={onShareInitiative}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                <span>共有</span>
              </button>
            )}
            {!isOwner && onLeaveInitiative && (
              !confirmLeave ? (
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-600 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>退出</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={leaving}
                    onClick={handleLeave}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap"
                  >
                    {leaving ? '退出中...' : '共有から退出'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(false)}
                    className="px-2 py-1 bg-white border border-slate-200 text-xs text-slate-600 rounded-md cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              )
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Team Tasks inside this Project */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-blue-700" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900">
                  このプロジェクト内の担当別タスク ({projectTasks.length}件)
                </h3>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onAddTaskForInitiative(initiative.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>担当タスクを追加</span>
                </button>
              )}
            </div>

            {/* Quick-add per participating team */}
            {canEdit && teamRefs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 mr-1">担当指定して追加:</span>
                {teamRefs.map((ref) => (
                  <button
                    key={`add-${ref.bureauId}-${ref.teamId}`}
                    type="button"
                    onClick={() => onAddTaskForInitiative(initiative.id, ref.bureauId, ref.teamId)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 rounded text-slate-700 transition-colors cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" aria-hidden="true" />
                    <span>{resolveTeamLabel(ref.bureauId, ref.teamId)}</span>
                  </button>
                ))}
              </div>
            )}

            {projectTasks.length === 0 ? (
              <p className="py-5 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-lg">
                まだ担当別タスクが登録されていません。「担当タスクを追加」から各担当の作業を登録してください。
              </p>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                {projectTasks.map((t) => {
                  const stage = stageById.get(t.stageId);
                  const tone = stage ? STAGE_TONES[stage.tone] : STAGE_TONES.neutral;
                  return (
                    <div
                      key={t.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-blue-50/40 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTask(t)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-500 shrink-0">
                            {resolveTeamLabel(t.bureauId, t.teamId)}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs font-semibold text-slate-900 hover:text-blue-700 truncate">
                            {t.title}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-mono tabular-nums">
                            {isDeadlineOnlyItem(t)
                              ? `〆 ${formatShortJP(getEffectiveDeadline(t))} (単日締切)`
                              : `${formatShortJP(t.startDate)}〜${formatShortJP(t.endDate)}${
                                  t.deadlineDate && t.deadlineDate !== t.endDate
                                    ? ` · 〆${formatShortJP(t.deadlineDate)}`
                                    : ''
                                }`}
                          </span>
                          {t.assigneeName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{t.assigneeName}</span>
                            </>
                          )}
                          {t.isVerified && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                確認済
                              </span>
                            </>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {canEdit ? (
                          <CustomSelect
                            value={stage ? t.stageId : ''}
                            options={stageSelectOptions}
                            onChange={(nextVal) => {
                              const nextStage = stageById.get(nextVal);
                              if (!nextStage) return;
                              onQuickUpdateTaskProgress(
                                t.id,
                                nextStage.id,
                                nextStage.defaultPercent
                              );
                            }}
                            placeholder="段階未設定"
                            ariaLabel={`${t.title}の進捗段階`}
                            size="xs"
                            align="right"
                            className="max-w-[132px]"
                            textClassName={stage ? `font-medium ${tone.textClass}` : 'text-slate-500'}
                          />
                        ) : (
                          <span
                            className={`text-[11px] font-medium ${
                              stage ? tone.textClass : 'text-slate-500'
                            }`}
                          >
                            {stage ? stage.name : '段階未設定'}
                          </span>
                        )}
                        <span className="text-xs font-mono tabular-nums font-bold text-slate-800 w-9 text-right">
                          {t.progressPercent}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-5 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-800">プロジェクト基本情報・全体設定</h3>
              {!canEdit && (
                <span className="text-[11px] text-slate-500">
                  ※閲覧のみ権限のため変更できません
                </span>
              )}
            </div>
            <fieldset disabled={!canEdit} className="space-y-5 disabled:opacity-80">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                プロジェクト名
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.INITIATIVE_NAME_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">開始日</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">終了予定日</label>
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  締め切り日（任意）
                </label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">カラー</label>
                {canEdit ? (
                  <CustomSelect
                    value={colorKey}
                    options={colorOptions}
                    onChange={(v) => setColorKey(v as ColorKey)}
                    ariaLabel="カラー"
                    className="w-full py-2"
                  />
                ) : (
                  <div className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center gap-2 bg-slate-50">
                    <span className={`w-2.5 h-2.5 rounded-xs ${palette.swatch}`} />
                    <span>{palette.label}</span>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={isMilestone}
                  onChange={(e) => setIsMilestone(e.target.checked)}
                  className="accent-blue-700"
                />
                <Diamond className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                <span>重要日程</span>
              </label>
            </div>

            {/* Multi-Stage Progress */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700">
                  プロジェクト進捗段階
                </label>
                <span className="text-xs font-mono tabular-nums font-bold text-blue-700">
                  現在 {progressPercent}%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {stages.map((st) => {
                  const selected = st.id === stageId;
                  const tone = STAGE_TONES[st.tone] || STAGE_TONES.neutral;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleStageSelect(st)}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                        canEdit ? 'cursor-pointer' : 'cursor-default'
                      } ${
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

            {/* Participating Teams Multi-Select */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-700" aria-hidden="true" />
                  <span className="text-xs font-semibold text-slate-800">
                    参加する局・担当（複数選択可）
                  </span>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {teamRefs.length}担当
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-44 overflow-y-auto">
                {bureaus.map((b) => {
                  const bPalette = BUREAU_COLORS[b.colorKey] || BUREAU_COLORS.slate;
                  return (
                    <div key={b.id} className="p-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`w-2 h-2 rounded-xs ${bPalette.swatch}`} />
                        <span className="text-[11px] font-semibold text-slate-800">{b.name}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-3">
                        {b.teams.map((tm) => {
                          const checked = isSelectedTeam(b.id, tm.id);
                          return (
                            <label
                              key={tm.id}
                              className={`flex items-center gap-2 px-2 py-1 rounded border text-[11px] ${
                                canEdit ? 'cursor-pointer' : 'cursor-default'
                              } ${
                                checked
                                  ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleTeamRef(b.id, tm.id)}
                                className="accent-blue-700"
                              />
                              <span className="truncate">{tm.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Verification Stamp */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                  className="accent-emerald-600 w-4 h-4"
                />
                <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>確認済みスタンプを付与</span>
              </label>
              {isVerified && (
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.VERIFIED_BY_MAX}
                  value={verifiedBy}
                  onChange={(e) => setVerifiedBy(e.target.value)}
                  placeholder="確認者名（例: 委員長 佐藤）"
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-800 w-full sm:w-48"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                概要・確認ポイント
              </label>
              <textarea
                rows={2}
                maxLength={FIELD_LIMITS.INITIATIVE_DESC_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="完了条件や他局との連携・確認事項など"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            </fieldset>

            {(isOwner || canEdit) && (
              <div className="flex items-center justify-between gap-3 pt-2">
                {isOwner ? (
                  !confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>プロジェクト削除</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        本当に削除する
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-2.5 py-1.5 border border-slate-200 text-xs text-slate-600 rounded-lg cursor-pointer"
                      >
                        キャンセル
                      </button>
                    </div>
                  )
                ) : (
                  <div />
                )}

                {canEdit && (
                  <div className="flex items-center gap-3">
                    {saveNotice && (
                      <span className="text-xs font-medium text-emerald-700">{saveNotice}</span>
                    )}
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Save className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{saving ? '保存中...' : '変更を保存'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Non-Messaging Verification Notes Section */}
          <div className="pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-slate-700" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">プロジェクト確認コメント</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              連絡やチャットのための欄ではありません。確認結果・承認事項・仕様変更の記録を残すために使用してください。
            </p>

            {canEdit && (
              <form
                onSubmit={handleAddNote}
                className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
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
                      placeholder="例: 総務局"
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

            <div className="mt-4 divide-y divide-slate-200">
              {notes.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  まだ確認コメントはありません。
                </p>
              ) : (
                notes.map((n) => {
                  const meta = NOTE_TYPE_LABELS[n.noteType] || NOTE_TYPE_LABELS.progress_check;
                  return (
                    <div key={n.id} className="py-3.5">
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
                            {formatNoteDate(n.createdAt)}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => deleteInitiativeNote(projectId, initiative.id, n.id)}
                              aria-label="記録を削除"
                              className="text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
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
