import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Diamond, Plus, Search } from 'lucide-react';
import {
  Bureau,
  BUREAU_COLORS,
  FestivalTask,
  Initiative,
  ProgressStage,
  STAGE_TONES,
} from '../types';
import {
  formatShortJP,
  getEffectiveDeadline,
  getTodayStr,
  isDeadlineOnlyItem,
} from '../utils/dateUtils';
import { CustomSelect } from './CustomSelect';

interface TaskListViewProps {
  bureaus: Bureau[];
  initiatives: Initiative[];
  stages: ProgressStage[];
  tasks: FestivalTask[];
  selectedBureauId: string | null;
  selectedTeamId: string | null;
  selectedInitiativeId: string | null;
  onSelectTask: (task: FestivalTask) => void;
  onSelectInitiative: (initiative: Initiative) => void;
  onCreateTask: () => void;
  canCreateAnyTask?: boolean;
  canEditInitiative?: (initiativeId?: string) => boolean;
  onQuickUpdateProgress: (
    taskId: string,
    stageId: string,
    progressPercent: number
  ) => Promise<void>;
  onToggleVerify: (task: FestivalTask) => Promise<void>;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  bureaus,
  initiatives,
  stages,
  tasks,
  selectedBureauId,
  selectedTeamId,
  selectedInitiativeId,
  onSelectTask,
  onSelectInitiative,
  onCreateTask,
  canCreateAnyTask = true,
  canEditInitiative,
  onQuickUpdateProgress,
  onToggleVerify,
}) => {
  const [search, setSearch] = useState('');
  const [initiativeFilter, setInitiativeFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [verifyFilter, setVerifyFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [draftPercents, setDraftPercents] = useState<Record<string, number>>({});

  const today = getTodayStr();
  const bureauById = useMemo(() => new Map(bureaus.map((b) => [b.id, b])), [bureaus]);
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const initiativeById = useMemo(
    () => new Map(initiatives.map((i) => [i.id, i])),
    [initiatives]
  );

  const initiativeFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'すべてのプロジェクト' },
      ...initiatives.map((init) => {
        const pal = BUREAU_COLORS[init.colorKey] || BUREAU_COLORS.slate;
        return { value: init.id, label: init.name, swatchClass: pal.swatch };
      }),
    ],
    [initiatives]
  );

  const stageFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'すべての進捗段階' },
      ...stages.map((s) => {
        const tone = STAGE_TONES[s.tone] || STAGE_TONES.neutral;
        return {
          value: s.id,
          label: s.name,
          subLabel: `${s.defaultPercent}%`,
          swatchClass: tone.indicatorClass,
          textClass: tone.textClass,
        };
      }),
    ],
    [stages]
  );

  const rowStageOptions = useMemo(
    () =>
      stages.map((s) => {
        const tone = STAGE_TONES[s.tone] || STAGE_TONES.neutral;
        return {
          value: s.id,
          label: s.name,
          subLabel: `${s.defaultPercent}%`,
          swatchClass: tone.indicatorClass,
          textClass: tone.textClass,
        };
      }),
    [stages]
  );

  const resolveTeamLabel = (bureauId: string, teamId: string) => {
    const b = bureauById.get(bureauId);
    const tm = b?.teams.find((item) => item.id === teamId);
    if (!b) return '未分類';
    return tm ? `${b.shortName}/${tm.name}` : b.name;
  };

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (t.status !== 'active') return false;
      if (selectedBureauId && t.bureauId !== selectedBureauId) return false;
      if (selectedTeamId && t.teamId !== selectedTeamId) return false;
      if (selectedInitiativeId && t.initiativeId !== selectedInitiativeId) return false;
      if (initiativeFilter !== 'all' && (t.initiativeId || '') !== initiativeFilter) return false;
      if (stageFilter !== 'all' && t.stageId !== stageFilter) return false;
      if (verifyFilter === 'verified' && !t.isVerified) return false;
      if (verifyFilter === 'unverified' && t.isVerified) return false;
      if (q) {
        const b = bureauById.get(t.bureauId);
        const tm = b?.teams.find((item) => item.id === t.teamId);
        const parentInit = t.initiativeId ? initiativeById.get(t.initiativeId) : undefined;
        const hay =
          `${t.title} ${t.description} ${t.assigneeName} ${b?.name || ''} ${b?.shortName || ''} ${tm?.name || ''} ${parentInit?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    tasks,
    selectedBureauId,
    selectedTeamId,
    selectedInitiativeId,
    initiativeFilter,
    stageFilter,
    verifyFilter,
    search,
    bureauById,
    initiativeById,
  ]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="タスク・プロジェクト・担当者検索..."
              className="pl-8 pr-3 py-1.5 w-60 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {!selectedInitiativeId && (
            <CustomSelect
              value={initiativeFilter}
              options={initiativeFilterOptions}
              onChange={setInitiativeFilter}
              ariaLabel="プロジェクトフィルタ"
              className="bg-slate-50 min-w-[160px] max-w-[200px]"
            />
          )}

          <CustomSelect
            value={stageFilter}
            options={stageFilterOptions}
            onChange={setStageFilter}
            ariaLabel="進捗段階フィルタ"
            className="bg-slate-50 min-w-[150px]"
          />

          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            {(
              [
                { id: 'all', label: 'すべて' },
                { id: 'unverified', label: '未確認のみ' },
                { id: 'verified', label: '確認済み' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVerifyFilter(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  verifyFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums text-slate-500">
            表示 {filteredTasks.length}件
          </span>
          {canCreateAnyTask && (
            <button
              type="button"
              onClick={onCreateTask}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>タスク追加</span>
            </button>
          )}
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="py-14 text-center text-sm text-slate-500">
          該当する担当タスクはありません。
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">タスク名 / 親プロジェクト</th>
                <th className="py-2.5 px-3 whitespace-nowrap">局・担当 / 担当者</th>
                <th className="py-2.5 px-3 whitespace-nowrap">期間・締切</th>
                <th className="py-2.5 px-3 whitespace-nowrap">進捗段階</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-44">進捗率</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-center">確認スタンプ</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">資料・詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTasks.map((t) => {
                const bureau = bureauById.get(t.bureauId);
                const palette = BUREAU_COLORS[bureau?.colorKey || 'slate'] || BUREAU_COLORS.slate;
                const stage = stageById.get(t.stageId);
                const tone = stage ? STAGE_TONES[stage.tone] : STAGE_TONES.neutral;
                const parentInit = t.initiativeId ? initiativeById.get(t.initiativeId) : undefined;
                const deadline = getEffectiveDeadline(t);
                const deadlineOnly = isDeadlineOnlyItem(t);
                const isLate = deadline < today && t.progressPercent < 100;
                const rowEditable = !canEditInitiative || canEditInitiative(t.initiativeId);

                return (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 max-w-xs">
                      <button
                        type="button"
                        onClick={() => onSelectTask(t)}
                        className="text-left font-semibold text-slate-900 hover:text-blue-700 flex items-center gap-2 cursor-pointer"
                      >
                        <span
                          className={`w-2 h-2 rounded-xs shrink-0 ${palette.swatch}`}
                          aria-hidden="true"
                        />
                        {t.isMilestone && (
                          <Diamond className="w-3.5 h-3.5 text-blue-700 fill-blue-100 shrink-0" />
                        )}
                        <span className="line-clamp-1">{t.title}</span>
                      </button>
                      {parentInit && (
                        <div className="mt-0.5 pl-4">
                          <button
                            type="button"
                            onClick={() => onSelectInitiative(parentInit)}
                            className="text-[11px] text-slate-500 hover:text-blue-700 hover:underline line-clamp-1 text-left cursor-pointer"
                          >
                            {parentInit.name}
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <p className="text-xs font-medium text-slate-800">
                        {resolveTeamLabel(t.bureauId, t.teamId)}
                      </p>
                      <p className="text-[11px] text-slate-500">{t.assigneeName || '担当未定'}</p>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap font-mono tabular-nums">
                      {deadlineOnly ? (
                        <span
                          className={
                            isLate
                              ? 'text-red-600 font-semibold'
                              : 'text-slate-800 font-semibold'
                          }
                        >
                          〆 {formatShortJP(deadline)}
                          <span className="ml-1 text-[10px] text-slate-500 font-normal">
                            (単日)
                          </span>
                        </span>
                      ) : (
                        <div>
                          <span className={isLate ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                            {formatShortJP(t.startDate)} - {formatShortJP(t.endDate)}
                          </span>
                          {t.deadlineDate && t.deadlineDate !== t.endDate && (
                            <p
                              className={`text-[10px] mt-0.5 ${
                                isLate ? 'text-red-600 font-semibold' : 'text-slate-500'
                              }`}
                            >
                              〆 {formatShortJP(t.deadlineDate)}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {rowEditable ? (
                        <CustomSelect
                          value={stage ? t.stageId : ''}
                          options={rowStageOptions}
                          onChange={(nextVal) => {
                            const nextStage = stageById.get(nextVal);
                            if (!nextStage) return;
                            onQuickUpdateProgress(
                              t.id,
                              nextStage.id,
                              nextStage.defaultPercent
                            );
                          }}
                          placeholder="段階未設定"
                          ariaLabel={`${t.title}の進捗段階`}
                          className="min-w-[120px] max-w-[160px]"
                          textClassName={stage ? `font-medium ${tone.textClass}` : 'text-slate-500'}
                        />
                      ) : (
                        <span
                          className={`text-xs ${
                            stage ? `font-medium ${tone.textClass}` : 'text-slate-500'
                          }`}
                        >
                          {stage?.name || '段階未設定'}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {rowEditable ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={draftPercents[t.id] ?? t.progressPercent}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setDraftPercents((prev) => ({ ...prev, [t.id]: val }));
                            }}
                            onPointerUp={(e) => {
                              const val = parseInt((e.target as HTMLInputElement).value, 10);
                              setDraftPercents((prev) => {
                                const next = { ...prev };
                                delete next[t.id];
                                return next;
                              });
                              onQuickUpdateProgress(t.id, stage ? t.stageId : '', val);
                            }}
                            onKeyUp={(e) => {
                              const val = parseInt((e.target as HTMLInputElement).value, 10);
                              setDraftPercents((prev) => {
                                const next = { ...prev };
                                delete next[t.id];
                                return next;
                              });
                              onQuickUpdateProgress(t.id, stage ? t.stageId : '', val);
                            }}
                            aria-label={`${t.title}の進捗率`}
                            className="w-24 accent-blue-700 cursor-pointer"
                          />
                          <span className="w-9 text-right font-mono tabular-nums font-semibold text-slate-800">
                            {draftPercents[t.id] ?? t.progressPercent}%
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono tabular-nums font-semibold text-slate-800">
                          {t.progressPercent}%
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {rowEditable ? (
                        <button
                          type="button"
                          onClick={() => onToggleVerify(t)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors cursor-pointer ${
                            t.isVerified
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {t.isVerified ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>確認済</span>
                            </>
                          ) : (
                            <>
                              <Circle className="w-3.5 h-3.5 text-slate-400" />
                              <span>未確認</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            t.isVerified ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {t.isVerified ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>確認済</span>
                            </>
                          ) : (
                            <span>未確認</span>
                          )}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectTask(t)}
                        className="px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                      >
                        ダッシュボード
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
