import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Diamond, Filter, Plus } from 'lucide-react';
import {
  Bureau,
  BUREAU_COLORS,
  FestivalTask,
  Initiative,
  ProgressStage,
  Project,
  STAGE_TONES,
} from '../types';
import {
  formatLocalDate,
  formatMonthYearJP,
  formatShortJP,
  getEffectiveDeadline,
  getTodayStr,
  getWeekdayJP,
  isDeadlineOnlyItem,
  parseLocalDate,
} from '../utils/dateUtils';
import { CustomSelect } from './CustomSelect';

interface MasterCalendarViewProps {
  project: Project;
  bureaus: Bureau[];
  initiatives: Initiative[];
  stages: ProgressStage[];
  tasks: FestivalTask[];
  selectedBureauId: string | null;
  selectedTeamId: string | null;
  selectedInitiativeId: string | null;
  onSelectTask: (task: FestivalTask) => void;
  onSelectInitiative: (initiative: Initiative) => void;
  onCreateDeadlineForDate?: (dateStr: string) => void;
}

export const MasterCalendarView: React.FC<MasterCalendarViewProps> = ({
  project,
  bureaus,
  initiatives,
  stages,
  tasks,
  selectedBureauId,
  selectedTeamId,
  selectedInitiativeId,
  onSelectTask,
  onSelectInitiative,
  onCreateDeadlineForDate,
}) => {
  const today = getTodayStr();
  const initialDate = parseLocalDate(today);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [onlyMilestonesOrDeadlines, setOnlyMilestonesOrDeadlines] = useState(false);

  const bureauById = useMemo(() => new Map(bureaus.map((b) => [b.id, b])), [bureaus]);
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const initiativeById = useMemo(
    () => new Map(initiatives.map((i) => [i.id, i])),
    [initiatives]
  );

  const resolveTeamLabel = (bureauId: string, teamId: string) => {
    const b = bureauById.get(bureauId);
    const tm = b?.teams.find((item) => item.id === teamId);
    if (!b) return '未分類';
    return tm ? `${b.shortName}/${tm.name}` : b.name;
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status !== 'active') return false;
      if (selectedBureauId && t.bureauId !== selectedBureauId) return false;
      if (selectedTeamId && t.teamId !== selectedTeamId) return false;
      if (selectedInitiativeId && t.initiativeId !== selectedInitiativeId) return false;
      if (stageFilter !== 'all' && t.stageId !== stageFilter) return false;
      return true;
    });
  }, [tasks, selectedBureauId, selectedTeamId, selectedInitiativeId, stageFilter]);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(viewYear, viewMonth, 1 - startOffset);

    const cells: { dateStr: string; inMonth: boolean; dayNum: number }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({
        dateStr: formatLocalDate(d),
        inMonth: d.getMonth() === viewMonth,
        dayNum: d.getDate(),
      });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    const d = parseLocalDate(today);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(today);
  };

  const goToFestival = () => {
    const d = parseLocalDate(project.festivalDate);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(project.festivalDate);
  };

  const filteredInitiatives = useMemo(() => {
    return initiatives.filter((init) => {
      if (selectedInitiativeId && init.id !== selectedInitiativeId) return false;
      if (!selectedBureauId && !selectedTeamId) return true;
      return (init.teamRefs || []).some((r) =>
        selectedTeamId
          ? r.bureauId === selectedBureauId && r.teamId === selectedTeamId
          : r.bureauId === selectedBureauId
      );
    });
  }, [initiatives, selectedInitiativeId, selectedBureauId, selectedTeamId]);

  const getInitiativeDeadlinesForDate = (dateStr: string) => {
    return filteredInitiatives.filter((init) => getEffectiveDeadline(init) === dateStr);
  };

  const getTasksForDate = (dateStr: string) => {
    return filteredTasks
      .filter((t) => {
        const deadline = getEffectiveDeadline(t);
        if (onlyMilestonesOrDeadlines) {
          return (
            deadline === dateStr ||
            (t.isMilestone && t.startDate <= dateStr && t.endDate >= dateStr)
          );
        }
        return (t.startDate <= dateStr && t.endDate >= dateStr) || deadline === dateStr;
      })
      .sort((a, b) => {
        const aDue = getEffectiveDeadline(a) === dateStr ? 0 : 1;
        const bDue = getEffectiveDeadline(b) === dateStr ? 0 : 1;
        if (aDue !== bDue) return aDue - bDue;
        if (a.isMilestone !== b.isMilestone) return a.isMilestone ? -1 : 1;
        return a.startDate.localeCompare(b.startDate);
      });
  };

  const selectedDayTasks = useMemo(
    () => getTasksForDate(selectedDate),
    [filteredTasks, selectedDate, onlyMilestonesOrDeadlines]
  );

  const selectedDayInitDeadlines = useMemo(
    () => getInitiativeDeadlinesForDate(selectedDate),
    [filteredInitiatives, selectedDate]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="前月"
              className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-bold text-slate-900 min-w-[110px] text-center font-mono tabular-nums">
              {formatMonthYearJP(viewYear, viewMonth)}
            </h2>
            <button
              type="button"
              onClick={goNextMonth}
              aria-label="翌月"
              className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={goToToday}
              className="ml-2 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              今日
            </button>
            <button
              type="button"
              onClick={goToFestival}
              className="px-3 py-1.5 border border-amber-300 bg-amber-50 rounded-lg text-xs font-medium text-amber-900 hover:bg-amber-100 cursor-pointer whitespace-nowrap"
            >
              本番日 ({formatShortJP(project.festivalDate)})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              <CustomSelect
                value={stageFilter}
                options={[
                  { value: 'all', label: '全段階' },
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
                ]}
                onChange={setStageFilter}
                ariaLabel="進捗段階で絞り込み"
                className="bg-slate-50 min-w-[130px]"
              />
            </div>

            <button
              type="button"
              onClick={() => setOnlyMilestonesOrDeadlines((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                onlyMilestonesOrDeadlines
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              締切・マイルストーンのみ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {['日', '月', '火', '水', '木', '金', '土'].map((w, idx) => (
            <div
              key={w}
              className={`py-2 text-center text-xs font-semibold border-r last:border-r-0 border-slate-200 ${
                idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-700' : 'text-slate-600'
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarCells.map((cell, idx) => {
            const dayTasks = getTasksForDate(cell.dateStr);
            const dayInitDeadlines = getInitiativeDeadlinesForDate(cell.dateStr);
            const totalItemsCount = dayInitDeadlines.length + dayTasks.length;
            const isToday = cell.dateStr === today;
            const isSelected = cell.dateStr === selectedDate;
            const isFestival =
              cell.dateStr >= project.festivalDate && cell.dateStr <= project.festivalEndDate;
            const isBorderRight = (idx + 1) % 7 !== 0;

            return (
              <div
                key={cell.dateStr}
                onClick={() => setSelectedDate(cell.dateStr)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDate(cell.dateStr);
                  }
                }}
                className={`min-h-[112px] p-1.5 border-b border-slate-200 ${
                  isBorderRight ? 'border-r' : ''
                } text-left transition-colors cursor-pointer flex flex-col ${
                  isSelected
                    ? 'bg-blue-50/60 ring-1 ring-inset ring-blue-600'
                    : isFestival
                      ? 'bg-amber-50/50 hover:bg-amber-50'
                      : cell.inMonth
                        ? 'bg-white hover:bg-slate-50/70'
                        : 'bg-slate-50/60 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between px-1 mb-1">
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isToday
                        ? 'px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold'
                        : cell.inMonth
                          ? 'font-semibold text-slate-800'
                          : 'text-slate-400'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {isFestival && (
                    <span className="text-[10px] font-bold text-amber-800 whitespace-nowrap">
                      本番
                    </span>
                  )}
                </div>

                <div className="space-y-1 flex-1 overflow-hidden">
                  {dayInitDeadlines.slice(0, 1).map((init) => {
                    const pal = BUREAU_COLORS[init.colorKey] || BUREAU_COLORS.slate;
                    return (
                      <button
                        key={`${cell.dateStr}-init-${init.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(cell.dateStr);
                          onSelectInitiative(init);
                        }}
                        className={`w-full px-1.5 py-0.5 rounded text-[10px] border text-left flex items-center justify-between gap-1 truncate cursor-pointer font-semibold ${pal.softBg} ${pal.border} ${pal.text}`}
                        title={`[プロジェクト締切] ${init.name}`}
                      >
                        <span className="truncate">[P] {init.name}</span>
                        <span className="font-mono tabular-nums shrink-0">〆</span>
                      </button>
                    );
                  })}

                  {dayTasks.slice(0, dayInitDeadlines.length > 0 ? 2 : 3).map((t) => {
                    const bureau = bureauById.get(t.bureauId);
                    const palette = BUREAU_COLORS[bureau?.colorKey || 'slate'] || BUREAU_COLORS.slate;
                    const isDueToday = getEffectiveDeadline(t) === cell.dateStr;

                    return (
                      <button
                        key={`${cell.dateStr}-${t.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(cell.dateStr);
                          onSelectTask(t);
                        }}
                        className={`w-full px-1.5 py-0.5 rounded text-[10px] border text-left flex items-center justify-between gap-1 truncate cursor-pointer ${
                          isDueToday
                            ? `${palette.softBg} ${palette.border} ${palette.text} font-semibold`
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                        title={`[${bureau?.shortName || '未'}] ${t.title} (${t.progressPercent}%)`}
                      >
                        <span className="flex items-center gap-1 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-xs shrink-0 ${palette.swatch}`}
                            aria-hidden="true"
                          />
                          {t.isMilestone && (
                            <Diamond className="w-2.5 h-2.5 text-blue-700 shrink-0" />
                          )}
                          <span className="truncate">
                            {bureau ? `[${bureau.shortName}] ` : ''}
                            {t.title}
                          </span>
                        </span>
                        {isDueToday && (
                          <span className="font-mono tabular-nums shrink-0 opacity-85">〆</span>
                        )}
                      </button>
                    );
                  })}

                  {totalItemsCount > 3 && (
                    <div className="px-1 text-[10px] font-mono tabular-nums text-slate-500 font-medium">
                      +他 {totalItemsCount - 3}件
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Day Schedule Inspector */}
      <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
        <div className="pb-3 border-b border-slate-200 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">選択日の稼働・締切予定</p>
            <h3 className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {selectedDate} ({getWeekdayJP(selectedDate)})
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono tabular-nums text-slate-600">
              {selectedDayInitDeadlines.length + selectedDayTasks.length}件
            </span>
            {onCreateDeadlineForDate && (
              <button
                type="button"
                onClick={() => onCreateDeadlineForDate(selectedDate)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3 h-3" aria-hidden="true" />
                <span>この日を締切に追加</span>
              </button>
            )}
          </div>
        </div>

        {selectedDate >= project.festivalDate && selectedDate <= project.festivalEndDate && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-900">
            大学祭 本番開催日です。全担当の当日稼働を確認してください。
          </div>
        )}

        {selectedDayInitDeadlines.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500">プロジェクト締め切り</p>
            {selectedDayInitDeadlines.map((init) => {
              const pal = BUREAU_COLORS[init.colorKey] || BUREAU_COLORS.slate;
              return (
                <button
                  key={`insp-init-${init.id}`}
                  type="button"
                  onClick={() => onSelectInitiative(init)}
                  className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${pal.softBg} ${pal.border} ${pal.text}`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">〆 {init.name}</p>
                    <p className="text-[10px] opacity-80 font-mono tabular-nums mt-0.5">
                      期間: {formatShortJP(init.startDate)}〜{formatShortJP(init.endDate)}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold shrink-0">詳細</span>
                </button>
              );
            })}
          </div>
        )}

        {selectedDayTasks.length === 0 && selectedDayInitDeadlines.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-xs text-slate-500">この日に該当するタスク・締め切りはありません。</p>
            {onCreateDeadlineForDate && (
              <button
                type="button"
                onClick={() => onCreateDeadlineForDate(selectedDate)}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{formatShortJP(selectedDate)} を締め切り日に設定して追加</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
            {selectedDayTasks.map((t) => {
              const bureau = bureauById.get(t.bureauId);
              const stage = stageById.get(t.stageId);
              const parentInit = t.initiativeId ? initiativeById.get(t.initiativeId) : undefined;
              const palette = BUREAU_COLORS[bureau?.colorKey || 'slate'] || BUREAU_COLORS.slate;
              const effectiveDeadline = getEffectiveDeadline(t);
              const deadlineOnly = isDeadlineOnlyItem(t);
              const isDeadline = effectiveDeadline === selectedDate;
              const isStart = t.startDate === selectedDate;

              return (
                <div key={`insp-${t.id}`} className="py-3">
                  <button
                    type="button"
                    onClick={() => onSelectTask(t)}
                    className="w-full px-2 py-1 -mx-2 hover:bg-slate-50 rounded-lg text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-xs shrink-0 ${palette.swatch}`}
                            aria-hidden="true"
                          />
                          {t.isMilestone && (
                            <Diamond
                              className="w-3 h-3 text-blue-700 fill-blue-100 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <p className="text-xs font-semibold text-slate-900 leading-snug truncate">
                            {t.title}
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {resolveTeamLabel(t.bureauId, t.teamId)}
                          {t.assigneeName ? ` · ${t.assigneeName}` : ''}
                        </p>
                      </div>
                      <span className="text-xs font-mono tabular-nums font-bold text-slate-900 shrink-0">
                        {t.progressPercent}%
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>{stage?.name || '段階未設定'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {deadlineOnly
                          ? `〆 ${formatShortJP(effectiveDeadline)} (単日)`
                          : `${formatShortJP(t.startDate)}〜${formatShortJP(t.endDate)}`}
                      </span>
                      {isDeadline && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-red-600">本日締切</span>
                        </>
                      )}
                      {!isDeadline && isStart && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-blue-700">開始日</span>
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

                  {parentInit && (
                    <div className="mt-1 pl-3.5">
                      <button
                        type="button"
                        onClick={() => onSelectInitiative(parentInit)}
                        className="text-[11px] text-blue-700 hover:underline cursor-pointer truncate max-w-full"
                      >
                        親プロジェクト: {parentInit.name}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
