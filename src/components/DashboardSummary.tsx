import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Diamond,
  Flag,
  FolderPlus,
  Plus,
  Share2,
} from 'lucide-react';
import {
  Bureau,
  BUREAU_COLORS,
  FestivalTask,
  Initiative,
  ProgressStage,
  ShareRole,
  STAGE_TONES,
} from '../types';
import {
  diffDays,
  formatShortJP,
  getEffectiveDeadline,
  getTodayStr,
  isDeadlineOnlyItem,
} from '../utils/dateUtils';
import { CustomSelect } from './CustomSelect';

interface DashboardSummaryProps {
  bureaus: Bureau[];
  initiatives: Initiative[];
  stages: ProgressStage[];
  tasks: FestivalTask[];
  isBoardOwner: boolean;
  getInitiativeRole: (initiativeId: string) => ShareRole | null;
  selectedBureauId: string | null;
  selectedTeamId: string | null;
  selectedInitiativeId: string | null;
  onSelectInitiative: (initiative: Initiative) => void;
  onShareInitiative: (initiative: Initiative) => void;
  onSelectTask: (task: FestivalTask) => void;
  onCreateInitiative: () => void;
  onCreateTaskForInitiative: (initiativeId: string, bureauId?: string, teamId?: string) => void;
  onQuickUpdateTaskProgress: (
    taskId: string,
    stageId: string,
    progressPercent: number
  ) => Promise<void>;
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  bureaus,
  initiatives,
  stages,
  tasks,
  isBoardOwner,
  getInitiativeRole,
  selectedBureauId,
  selectedTeamId,
  selectedInitiativeId,
  onSelectInitiative,
  onShareInitiative,
  onSelectTask,
  onCreateInitiative,
  onCreateTaskForInitiative,
  onQuickUpdateTaskProgress,
}) => {
  const today = getTodayStr();
  const activeTasks = tasks.filter((t) => t.status === 'active');
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const bureauById = new Map(bureaus.map((b) => [b.id, b]));

  const stageSelectOptions = stages.map((s) => {
    const stTone = STAGE_TONES[s.tone] || STAGE_TONES.neutral;
    return {
      value: s.id,
      label: s.name,
      subLabel: `${s.defaultPercent}%`,
      swatchClass: stTone.indicatorClass,
      textClass: stTone.textClass,
    };
  });

  const resolveTeamLabel = (bureauId: string, teamId: string) => {
    const b = bureauById.get(bureauId);
    const tm = b?.teams.find((item) => item.id === teamId);
    if (!b) return '未分類';
    return tm ? `${b.shortName}/${tm.name}` : b.name;
  };

  const filteredInitiatives = initiatives.filter((init) => {
    if (selectedInitiativeId && init.id !== selectedInitiativeId) return false;
    if (!selectedBureauId && !selectedTeamId) return true;
    const matchesRef = (init.teamRefs || []).some((r) =>
      selectedTeamId
        ? r.bureauId === selectedBureauId && r.teamId === selectedTeamId
        : r.bureauId === selectedBureauId
    );
    const matchesTask = activeTasks.some(
      (t) =>
        t.initiativeId === init.id &&
        t.bureauId === selectedBureauId &&
        (!selectedTeamId || t.teamId === selectedTeamId)
    );
    return matchesRef || matchesTask;
  });

  const scopedTasks = activeTasks.filter((t) => {
    if (selectedInitiativeId && t.initiativeId !== selectedInitiativeId) return false;
    if (selectedBureauId && t.bureauId !== selectedBureauId) return false;
    if (selectedTeamId && t.teamId !== selectedTeamId) return false;
    return true;
  });

  const overdueTasks = scopedTasks.filter(
    (t) => getEffectiveDeadline(t) < today && t.progressPercent < 100
  );
  const dueSoonTasks = scopedTasks.filter((t) => {
    const dl = getEffectiveDeadline(t);
    return dl >= today && diffDays(today, dl) <= 4 && t.progressPercent < 100;
  });
  const milestoneTasks = scopedTasks.filter((t) => t.isMilestone);

  return (
    <div className="space-y-6">
      {/* Projects & Nested Team Tasks */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              プロジェクト別 進捗状況・担当タスク
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              各プロジェクトの枠内で、参加する局・担当ごとに必要なタスクを追加し、クリックで資料添付ダッシュボードを開けます
            </p>
          </div>
          {isBoardOwner && (
            <button
              type="button"
              onClick={onCreateInitiative}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>新規プロジェクト作成</span>
            </button>
          )}
        </div>

        {filteredInitiatives.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-600">該当するプロジェクトがありません。</p>
            {isBoardOwner && (
              <button
                type="button"
                onClick={onCreateInitiative}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>プロジェクトを作成する</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredInitiatives.map((init) => {
              const initTasks = activeTasks.filter((t) => t.initiativeId === init.id);
              const visibleTasks = initTasks.filter((t) => {
                if (selectedBureauId && t.bureauId !== selectedBureauId) return false;
                if (selectedTeamId && t.teamId !== selectedTeamId) return false;
                return true;
              });

              const avgPct =
                initTasks.length > 0
                  ? Math.round(
                      initTasks.reduce((acc, t) => acc + t.progressPercent, 0) / initTasks.length
                    )
                  : (init.progressPercent ?? 0);
              const doneCount = initTasks.filter((t) => t.progressPercent >= 100).length;
              const palette = BUREAU_COLORS[init.colorKey] || BUREAU_COLORS.slate;
              const initDeadline = getEffectiveDeadline(init);
              const isLate = initDeadline < today && avgPct < 100;
              const role = getInitiativeRole(init.id);
              const canEdit = role === 'owner' || role === 'editor';

              return (
                <div
                  key={init.id}
                  className="p-4 border border-slate-200 rounded-xl flex flex-col justify-between gap-3.5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectInitiative(init)}
                        className="text-left group cursor-pointer min-w-0 flex items-center gap-2"
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-xs shrink-0 ${palette.swatch}`}
                          aria-hidden="true"
                        />
                        {init.isMilestone && (
                          <Diamond
                            className="w-3.5 h-3.5 text-blue-700 fill-blue-100 shrink-0"
                            aria-label="重要マイルストーン"
                          />
                        )}
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                          {init.name}
                        </h3>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {role === 'owner' ? (
                          <button
                            type="button"
                            onClick={() => onShareInitiative(init)}
                            title="このプロジェクトを他メンバーと共有"
                            className="inline-flex items-center gap-1 px-2 py-0.5 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 hover:text-blue-800 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap"
                          >
                            <Share2 className="w-3 h-3" aria-hidden="true" />
                            <span>共有</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                            {role === 'editor' ? '共有·共同編集' : '共有·閲覧のみ'}
                          </span>
                        )}
                        <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                          {avgPct}%
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectInitiative(init)}
                          className="text-xs font-medium text-blue-700 hover:underline cursor-pointer whitespace-nowrap"
                        >
                          詳細
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isLate ? 'bg-red-600' : palette.barFill
                        }`}
                        style={{ width: `${avgPct}%` }}
                      />
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="font-mono tabular-nums">
                        {formatShortJP(init.startDate)}〜{formatShortJP(init.endDate)}
                        {init.deadlineDate && init.deadlineDate !== init.endDate && (
                          <span className={isLate ? 'text-red-600 font-semibold ml-1.5' : 'ml-1.5'}>
                            (〆 {formatShortJP(init.deadlineDate)})
                          </span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums">
                        タスク {doneCount}/{initTasks.length}完了
                      </span>
                    </div>

                    {/* Participating Teams */}
                    <div className="mt-2 text-[11px] text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-700 mr-1.5">参加担当:</span>
                      {init.teamRefs.length === 0 ? (
                        <span className="text-slate-400">未設定</span>
                      ) : (
                        init.teamRefs.map((ref, idx) => (
                          <span key={`${ref.bureauId}-${ref.teamId}`}>
                            {idx > 0 && (
                              <span className="mx-1.5 text-slate-300" aria-hidden="true">
                                ·
                              </span>
                            )}
                            <span>{resolveTeamLabel(ref.bureauId, ref.teamId)}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Embedded Team Tasks List */}
                  <div className="pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-600">
                        担当別タスク
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            onCreateTaskForInitiative(
                              init.id,
                              selectedBureauId || init.teamRefs[0]?.bureauId,
                              selectedTeamId || init.teamRefs[0]?.teamId
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                        >
                          <Plus className="w-3 h-3" aria-hidden="true" />
                          <span>担当タスクを追加</span>
                        </button>
                      )}
                    </div>

                    {visibleTasks.length === 0 ? (
                      <p className="py-2 text-[11px] text-slate-400">
                        担当タスクはまだ登録されていません
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {visibleTasks.map((t) => {
                          const stage = stageById.get(t.stageId);
                          const tone = stage ? STAGE_TONES[stage.tone] : STAGE_TONES.neutral;
                          const taskDeadline = getEffectiveDeadline(t);
                          const taskLate = taskDeadline < today && t.progressPercent < 100;

                          return (
                            <div
                              key={t.id}
                              className="py-2 px-1.5 -mx-1.5 rounded-md hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors"
                            >
                              <button
                                type="button"
                                onClick={() => onSelectTask(t)}
                                className="min-w-0 flex-1 text-left cursor-pointer"
                              >
                                <p
                                  className={`text-xs font-medium truncate hover:text-blue-700 ${
                                    taskLate ? 'text-red-700' : 'text-slate-900'
                                  }`}
                                >
                                  {t.title}
                                </p>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                                  <span>{resolveTeamLabel(t.bureauId, t.teamId)}</span>
                                  {t.assigneeName && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>{t.assigneeName}</span>
                                    </>
                                  )}
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className={`font-mono tabular-nums ${
                                      taskLate ? 'text-red-600 font-semibold' : ''
                                    }`}
                                  >
                                    〆 {formatShortJP(taskDeadline)}
                                    {isDeadlineOnlyItem(t) ? ' (単日)' : ''}
                                  </span>
                                </div>
                              </button>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {t.isVerified && (
                                  <CheckCircle2
                                    className="w-3.5 h-3.5 text-emerald-600"
                                    aria-label="確認済"
                                  />
                                )}
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
                                    className="max-w-[126px]"
                                    textClassName={stage ? `font-medium ${tone.textClass}` : 'text-slate-500'}
                                  />
                                ) : (
                                  <span
                                    className={`text-[11px] truncate max-w-[110px] ${
                                      stage ? `font-medium ${tone.textClass}` : 'text-slate-500'
                                    }`}
                                  >
                                    {stage?.name || '段階未設定'}
                                  </span>
                                )}
                                <span className="text-xs font-mono tabular-nums font-bold text-slate-800 w-8 text-right">
                                  {t.progressPercent}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two-Column Attention Tasks & Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
              <span>期限確認・要注意タスク</span>
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {overdueTasks.length + dueSoonTasks.length}件
            </span>
          </div>

          {overdueTasks.length === 0 && dueSoonTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              期限超過または4日以内に締切を迎える未完了タスクはありません。
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-1">
              {[...overdueTasks, ...dueSoonTasks].map((t) => {
                const stage = stageById.get(t.stageId);
                const taskDeadline = getEffectiveDeadline(t);
                const isOverdue = taskDeadline < today;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTask(t)}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{t.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{resolveTeamLabel(t.bureauId, t.teamId)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{stage?.name || '段階未設定'}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-mono tabular-nums font-medium ${
                            isOverdue ? 'text-red-600' : 'text-amber-700'
                          }`}
                        >
                          {isOverdue
                            ? `期限超過 (${formatShortJP(taskDeadline)})`
                            : `締切 ${formatShortJP(taskDeadline)}`}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-800 shrink-0">
                      {t.progressPercent}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Flag className="w-4 h-4 text-blue-700" aria-hidden="true" />
              <span>主要マイルストーン・重要日程</span>
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {milestoneTasks.length}件
            </span>
          </div>

          {milestoneTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              重要マイルストーンに設定されたタスクはありません。
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-1">
              {milestoneTasks.map((t) => {
                const stage = stageById.get(t.stageId);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTask(t)}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {t.title}
                        </span>
                        {t.isVerified && (
                          <CheckCircle2
                            className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                            aria-label="確認済み"
                          />
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
                        <span className="font-mono tabular-nums">
                          {isDeadlineOnlyItem(t)
                            ? `〆 ${formatShortJP(getEffectiveDeadline(t))}`
                            : `${formatShortJP(t.startDate)} 〜 ${formatShortJP(t.endDate)}${
                                t.deadlineDate && t.deadlineDate !== t.endDate
                                  ? ` (〆${formatShortJP(t.deadlineDate)})`
                                  : ''
                              }`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{resolveTeamLabel(t.bureauId, t.teamId)}</span>
                        {stage && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{stage.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-800 shrink-0">
                      {t.progressPercent}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
