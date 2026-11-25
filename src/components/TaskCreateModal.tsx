import React, { useMemo, useState } from 'react';
import { Diamond, Plus, X } from 'lucide-react';
import { Bureau, BUREAU_COLORS, FIELD_LIMITS, Initiative, ProgressStage, STAGE_TONES } from '../types';
import { addDays, getTodayStr } from '../utils/dateUtils';
import { saveTask } from '../services/firestoreService';
import { CustomSelect } from './CustomSelect';

interface TaskCreateModalProps {
  uid: string;
  projectId: string;
  bureaus: Bureau[];
  initiatives: Initiative[];
  stages: ProgressStage[];
  isBoardOwner?: boolean;
  allowUnassigned?: boolean;
  defaultBureauId: string | null;
  defaultTeamId: string | null;
  defaultInitiativeId: string | null;
  defaultDeadlineDate?: string | null;
  onClose: () => void;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  uid,
  projectId,
  bureaus,
  initiatives,
  stages,
  isBoardOwner = true,
  allowUnassigned,
  defaultBureauId,
  defaultTeamId,
  defaultInitiativeId,
  defaultDeadlineDate,
  onClose,
}) => {
  const canLeaveUnassigned = allowUnassigned ?? isBoardOwner;
  const today = getTodayStr();
  const initialInitiativeId =
    (defaultInitiativeId && initiatives.some((i) => i.id === defaultInitiativeId)
      ? defaultInitiativeId
      : '') ||
    initiatives[0]?.id ||
    '';
  const matchedInit = initiatives.find((i) => i.id === initialInitiativeId);

  const candidateBureauId =
    defaultBureauId ||
    matchedInit?.teamRefs?.[0]?.bureauId ||
    bureaus[0]?.id ||
    '';

  const fallbackBureau = bureaus.find((b) => b.id === candidateBureauId) || bureaus[0];
  const candidateTeamId =
    defaultTeamId ||
    matchedInit?.teamRefs?.find((r) => r.bureauId === fallbackBureau?.id)?.teamId ||
    fallbackBureau?.teams[0]?.id ||
    '';
  const fallbackTeamId =
    fallbackBureau?.teams.find((t) => t.id === candidateTeamId)?.id ||
    fallbackBureau?.teams[0]?.id ||
    '';

  const [initiativeId, setInitiativeId] = useState(initialInitiativeId);
  const [title, setTitle] = useState('');
  const [bureauId, setBureauId] = useState(fallbackBureau?.id || '');
  const [teamId, setTeamId] = useState(fallbackTeamId);
  const [assigneeName, setAssigneeName] = useState('');
  const [stageId, setStageId] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [scheduleMode, setScheduleMode] = useState<'period' | 'deadline'>(
    defaultDeadlineDate ? 'deadline' : 'period'
  );
  const [startDate, setStartDate] = useState(matchedInit?.startDate || today);
  const [endDate, setEndDate] = useState(matchedInit?.endDate || addDays(today, 7));
  const [periodDeadlineDate, setPeriodDeadlineDate] = useState('');
  const [singleDeadlineDate, setSingleDeadlineDate] = useState(
    defaultDeadlineDate || matchedInit?.deadlineDate || matchedInit?.endDate || addDays(today, 7)
  );
  const [isMilestone, setIsMilestone] = useState(false);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedInit = useMemo(
    () => initiatives.find((i) => i.id === initiativeId) || null,
    [initiatives, initiativeId]
  );

  const currentBureau = bureaus.find((b) => b.id === bureauId) || bureaus[0];
  const teams = currentBureau?.teams || [];

  const handleInitiativeChange = (nextInitId: string) => {
    setInitiativeId(nextInitId);
    const nextInit = initiatives.find((i) => i.id === nextInitId);
    if (nextInit && nextInit.teamRefs && nextInit.teamRefs.length > 0) {
      const validRef = nextInit.teamRefs.find((ref) =>
        bureaus.some((b) => b.id === ref.bureauId)
      );
      if (validRef) {
        const targetB = bureaus.find((b) => b.id === validRef.bureauId);
        const validTeam =
          targetB?.teams.find((tm) => tm.id === validRef.teamId)?.id ||
          targetB?.teams[0]?.id ||
          '';
        setBureauId(validRef.bureauId);
        setTeamId(validTeam);
      }
    }
  };

  const handleBureauChange = (nextBureauId: string) => {
    setBureauId(nextBureauId);
    const nextB = bureaus.find((b) => b.id === nextBureauId);
    setTeamId(nextB?.teams[0]?.id || '');
  };

  const handleQuickPickTeamRef = (bId: string, tId: string) => {
    const targetB = bureaus.find((b) => b.id === bId);
    if (!targetB) return;
    const validTeamId = targetB.teams.find((t) => t.id === tId)?.id || targetB.teams[0]?.id || '';
    setBureauId(bId);
    setTeamId(validTeamId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveBureauId = bureauId || bureaus[0]?.id || '';
    const effectiveBureau = bureaus.find((b) => b.id === effectiveBureauId);
    const effectiveTeamId = teamId || effectiveBureau?.teams[0]?.id || '';

    if (!canLeaveUnassigned && !initiativeId) {
      setErrorMsg('共有プロジェクトを選択してください。');
      return;
    }

    if (!title.trim() || !effectiveBureauId || !effectiveTeamId) {
      setErrorMsg('タスク名・局・担当を入力してください。');
      return;
    }

    if (scheduleMode === 'deadline' && !singleDeadlineDate) {
      setErrorMsg('締め切り日を入力してください。');
      return;
    }

    const finalStartDate = scheduleMode === 'deadline' ? singleDeadlineDate : startDate;
    const finalEndDate =
      scheduleMode === 'deadline'
        ? singleDeadlineDate
        : endDate >= startDate
          ? endDate
          : startDate;
    const finalDeadlineDate =
      scheduleMode === 'deadline' ? singleDeadlineDate : periodDeadlineDate;

    setSaving(true);
    setErrorMsg(null);
    try {
      await saveTask(
        uid,
        projectId,
        {
          title,
          description,
          bureauId: effectiveBureauId,
          teamId: effectiveTeamId,
          assigneeName,
          initiativeId,
          stageId: stageId || '',
          progressPercent,
          startDate: finalStartDate,
          endDate: finalEndDate,
          deadlineDate: finalDeadlineDate,
          isMilestone,
          isVerified: false,
          verifiedBy: '',
        },
        true
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'タスクの作成に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const resolveTeamLabel = (bId: string, tId: string) => {
    const b = bureaus.find((item) => item.id === bId);
    const tm = b?.teams.find((item) => item.id === tId);
    if (!b) return '未分類';
    return tm ? `${b.shortName}/${tm.name}` : b.name;
  };

  const initiativeOptions = useMemo(() => {
    const mapped = initiatives.map((init) => {
      const pal = BUREAU_COLORS[init.colorKey] || BUREAU_COLORS.slate;
      return {
        value: init.id,
        label: init.name,
        swatchClass: pal.swatch,
      };
    });
    return canLeaveUnassigned
      ? [{ value: '', label: '（プロジェクト指定なし）' }, ...mapped]
      : mapped;
  }, [initiatives, canLeaveUnassigned]);

  const bureauOptions = useMemo(
    () =>
      bureaus.map((b) => {
        const pal = BUREAU_COLORS[b.colorKey] || BUREAU_COLORS.slate;
        return {
          value: b.id,
          label: b.name,
          swatchClass: pal.swatch,
        };
      }),
    [bureaus]
  );

  const teamOptions = useMemo(
    () =>
      teams.map((tm) => ({
        value: tm.id,
        label: tm.name,
      })),
    [teams]
  );

  const stageOptions = useMemo(
    () => [
      { value: '', label: '（指定しない）' },
      ...stages.map((st) => {
        const tone = STAGE_TONES[st.tone] || STAGE_TONES.neutral;
        return {
          value: st.id,
          label: st.name,
          subLabel: `${st.defaultPercent}%`,
          swatchClass: tone.indicatorClass,
          textClass: tone.textClass,
        };
      }),
    ],
    [stages]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="担当タスクを追加"
    >
      <div
        className="w-full max-w-xl bg-white border border-slate-200 rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-bold text-slate-900">プロジェクトに担当タスクを追加</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              所属プロジェクト（大枠）
            </label>
            <CustomSelect
              value={initiativeId}
              options={initiativeOptions}
              onChange={handleInitiativeChange}
              ariaLabel="所属プロジェクト"
              className="w-full py-2 px-3 font-medium"
            />
          </div>

          {selectedInit && selectedInit.teamRefs.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-[11px] font-medium text-slate-600 mb-2">
                このプロジェクトに参加している担当から選択:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedInit.teamRefs.map((ref) => {
                  const active = bureauId === ref.bureauId && teamId === ref.teamId;
                  return (
                    <button
                      key={`${ref.bureauId}-${ref.teamId}`}
                      type="button"
                      onClick={() => handleQuickPickTeamRef(ref.bureauId, ref.teamId)}
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {resolveTeamLabel(ref.bureauId, ref.teamId)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                担当局 <span className="text-red-600">*</span>
              </label>
              <CustomSelect
                value={currentBureau?.id || ''}
                options={bureauOptions}
                onChange={handleBureauChange}
                ariaLabel="担当局"
                placeholder="局を選択"
                className="w-full py-2 px-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                担当 <span className="text-red-600">*</span>
              </label>
              <CustomSelect
                value={teamId}
                options={teamOptions}
                onChange={setTeamId}
                ariaLabel="担当"
                placeholder="担当を選択"
                className="w-full py-2 px-2.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              タスク名 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.TASK_TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 控室レイアウト図の作成と総務局への提出"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">担当者</label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.ASSIGNEE_MAX}
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="例: 佐藤 健"
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                初期進捗段階（任意）
              </label>
              <CustomSelect
                value={stageId}
                options={stageOptions}
                onChange={(nextId) => {
                  setStageId(nextId);
                  if (!nextId) {
                    setProgressPercent(0);
                    return;
                  }
                  const st = stages.find((s) => s.id === nextId);
                  if (st) setProgressPercent(st.defaultPercent);
                }}
                ariaLabel="初期進捗段階（任意）"
                placeholder="（指定しない）"
                className="w-full py-2 px-2.5"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700">初期進捗率の微調整（任意）</span>
              <span className="text-xs font-mono tabular-nums font-bold text-blue-700">
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
              aria-label="初期進捗率"
              className="w-full accent-blue-700 cursor-pointer"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">日程・締め切りの設定方法</span>
              <div className="flex items-center p-0.5 bg-slate-200/70 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setScheduleMode('period')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    scheduleMode === 'period'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  作業期間 ＋ 締め切り日
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('deadline')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    scheduleMode === 'deadline'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  締め切り日として登録（単日〆）
                </button>
              </div>
            </div>

            {scheduleMode === 'deadline' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    締め切り日（〆） <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={singleDeadlineDate}
                    onChange={(e) => setSingleDeadlineDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={isMilestone}
                    onChange={(e) => setIsMilestone(e.target.checked)}
                    className="accent-blue-700"
                  />
                  <Diamond className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                  <span>重要日程</span>
                </label>
                <p className="sm:col-span-2 text-[11px] text-slate-500">
                  単日の「〆 締め切りピン」としてガントチャートとカレンダーに表示されます。
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">開始日</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
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
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      締め切り日（任意）
                    </label>
                    <input
                      type="date"
                      value={periodDeadlineDate}
                      onChange={(e) => setPeriodDeadlineDate(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500">
                    締め切り日が未入力の場合は終了予定日が締切として扱われます。
                  </p>
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
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
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              完了条件・内容メモ
            </label>
            <textarea
              rows={2}
              maxLength={FIELD_LIMITS.TASK_DESC_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="提出が必要な資料や確認事項など"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{saving ? '追加中...' : 'タスクを追加'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
