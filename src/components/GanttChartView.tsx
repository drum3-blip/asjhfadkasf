import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Diamond,
  Plus,
  Search,
  Target,
} from 'lucide-react';
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
  addDays,
  diffDays,
  formatShortJP,
  getDatesInRange,
  getEffectiveDeadline,
  getTodayStr,
  getWeekdayJP,
  isDeadlineOnlyItem,
} from '../utils/dateUtils';
import { CustomSelect } from './CustomSelect';

interface GanttChartViewProps {
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
  onAddTaskToInitiative: (initiativeId: string) => void;
  canEditInitiative?: (initiativeId?: string) => boolean;
}

type ZoomScale = 'day' | 'week' | 'month';
type GroupByMode = 'initiative' | 'bureau';

const SCALE_WIDTH: Record<ZoomScale, number> = {
  day: 40,
  week: 22,
  month: 11,
};

export const GanttChartView: React.FC<GanttChartViewProps> = ({
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
  onAddTaskToInitiative,
  canEditInitiative,
}) => {
  const [zoom, setZoom] = useState<ZoomScale>('day');
  const [groupBy, setGroupBy] = useState<GroupByMode>('initiative');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [onlyUnverifiedOrLate, setOnlyUnverifiedOrLate] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const today = getTodayStr();
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const bureauById = useMemo(() => new Map(bureaus.map((b) => [b.id, b])), [bureaus]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (t.status !== 'active') return false;
      if (selectedBureauId && t.bureauId !== selectedBureauId) return false;
      if (selectedTeamId && t.teamId !== selectedTeamId) return false;
      if (selectedInitiativeId && t.initiativeId !== selectedInitiativeId) return false;
      if (stageFilter !== 'all' && t.stageId !== stageFilter) return false;
      if (onlyUnverifiedOrLate) {
        const isLate = getEffectiveDeadline(t) < today && t.progressPercent < 100;
        if (t.isVerified && !isLate) return false;
      }
      if (q) {
        const b = bureauById.get(t.bureauId);
        const tm = b?.teams.find((item) => item.id === t.teamId);
        const hay = `${t.title} ${t.assigneeName} ${t.description} ${b?.name || ''} ${tm?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    tasks,
    selectedBureauId,
    selectedTeamId,
    selectedInitiativeId,
    stageFilter,
    onlyUnverifiedOrLate,
    search,
    today,
    bureauById,
  ]);

  const { timelineStart, daysList } = useMemo(() => {
    const candidateDates = [
      today,
      project.festivalDate,
      project.festivalEndDate,
      ...initiatives.flatMap((i) => [i.startDate, i.endDate, i.deadlineDate || '']),
      ...filteredTasks.flatMap((t) => [t.startDate, t.endDate, t.deadlineDate || '']),
    ].filter(Boolean);

    candidateDates.sort();
    const minD = candidateDates[0] || today;
    const maxD = candidateDates[candidateDates.length - 1] || addDays(today, 21);

    const start = addDays(minD, -4);
    const end = addDays(maxD, 6);
    const list = getDatesInRange(start, end);
    return { timelineStart: start, daysList: list };
  }, [filteredTasks, initiatives, project.festivalDate, project.festivalEndDate, today]);

  const dayWidth = SCALE_WIDTH[zoom];
  const totalWidth = daysList.length * dayWidth;
  const todayOffsetDays = diffDays(timelineStart, today);

  const scrollToToday = () => {
    if (!scrollRef.current) return;
    const targetX = Math.max(0, todayOffsetDays * dayWidth - 240);
    scrollRef.current.scrollTo({ left: targetX, behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const targetX = Math.max(0, todayOffsetDays * dayWidth - 180);
        scrollRef.current.scrollLeft = targetX;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [zoom, todayOffsetDays, dayWidth]);

  type GanttRow =
    | {
        type: 'group';
        groupId: string;
        initiative?: Initiative;
        title: string;
        subtitle?: string;
        colorKey: Bureau['colorKey'];
        avg: number;
        minStart?: string;
        maxEnd?: string;
      }
    | { type: 'sub'; key: string; title: string; count: number }
    | { type: 'task'; bureau?: Bureau; task: FestivalTask };

  const rows: GanttRow[] = useMemo(() => {
    const result: GanttRow[] = [];

    if (groupBy === 'initiative') {
      const targetInits = selectedInitiativeId
        ? initiatives.filter((i) => i.id === selectedInitiativeId)
        : initiatives;

      for (const init of targetInits) {
        const iTasks = filteredTasks.filter((t) => t.initiativeId === init.id);
        if (
          iTasks.length === 0 &&
          (search || stageFilter !== 'all' || onlyUnverifiedOrLate || selectedBureauId)
        ) {
          continue;
        }
        const avg =
          iTasks.length > 0
            ? Math.round(iTasks.reduce((acc, t) => acc + t.progressPercent, 0) / iTasks.length)
            : (init.progressPercent ?? 0);
        const sortedStarts = [init.startDate, ...iTasks.map((t) => t.startDate)].sort();
        const sortedEnds = [
          init.endDate,
          init.deadlineDate || '',
          ...iTasks.flatMap((t) => [t.endDate, t.deadlineDate || '']),
        ]
          .filter(Boolean)
          .sort();

        result.push({
          type: 'group',
          groupId: init.id,
          initiative: init,
          title: init.name,
          subtitle: `${iTasks.length}タスク`,
          colorKey: init.colorKey,
          avg,
          minStart: sortedStarts[0] || init.startDate,
          maxEnd: sortedEnds[sortedEnds.length - 1] || init.endDate,
        });

        if (collapsedGroups[init.id]) continue;
        for (const t of iTasks) {
          result.push({ type: 'task', bureau: bureauById.get(t.bureauId), task: t });
        }
      }

      const initIdSet = new Set(initiatives.map((i) => i.id));
      const unassigned = filteredTasks.filter(
        (t) => !t.initiativeId || !initIdSet.has(t.initiativeId)
      );
      if (unassigned.length > 0 && !selectedInitiativeId) {
        const avg = Math.round(
          unassigned.reduce((acc, t) => acc + t.progressPercent, 0) / unassigned.length
        );
        const sortedStarts = unassigned.map((t) => t.startDate).sort();
        const sortedEnds = unassigned.map((t) => t.endDate).sort();
        result.push({
          type: 'group',
          groupId: 'unassigned',
          title: 'プロジェクト未設定タスク',
          subtitle: `${unassigned.length}タスク`,
          colorKey: 'slate',
          avg,
          minStart: sortedStarts[0],
          maxEnd: sortedEnds[sortedEnds.length - 1],
        });
        if (!collapsedGroups['unassigned']) {
          for (const t of unassigned) {
            result.push({ type: 'task', bureau: bureauById.get(t.bureauId), task: t });
          }
        }
      }

      return result;
    }

    // Group by Bureau -> Team
    const targetBureaus = selectedBureauId
      ? bureaus.filter((b) => b.id === selectedBureauId)
      : bureaus;

    for (const bureau of targetBureaus) {
      const bTasks = filteredTasks.filter((t) => t.bureauId === bureau.id);
      if (
        bTasks.length === 0 &&
        (search || stageFilter !== 'all' || onlyUnverifiedOrLate || selectedInitiativeId)
      ) {
        continue;
      }

      const avg =
        bTasks.length > 0
          ? Math.round(bTasks.reduce((acc, t) => acc + t.progressPercent, 0) / bTasks.length)
          : 0;
      const sortedStarts = bTasks.map((t) => t.startDate).sort();
      const sortedEnds = bTasks
        .flatMap((t) => [t.endDate, t.deadlineDate || ''])
        .filter(Boolean)
        .sort();

      result.push({
        type: 'group',
        groupId: bureau.id,
        title: bureau.name,
        subtitle: `${bTasks.length}タスク`,
        colorKey: bureau.colorKey,
        avg,
        minStart: sortedStarts[0],
        maxEnd: sortedEnds[sortedEnds.length - 1],
      });

      if (collapsedGroups[bureau.id]) continue;

      const targetTeams = selectedTeamId
        ? bureau.teams.filter((tm) => tm.id === selectedTeamId)
        : bureau.teams;

      for (const team of targetTeams) {
        const tmTasks = bTasks.filter((t) => t.teamId === team.id);
        if (tmTasks.length === 0) continue;
        result.push({
          type: 'sub',
          key: `${bureau.id}-${team.id}`,
          title: team.name,
          count: tmTasks.length,
        });
        for (const t of tmTasks) {
          result.push({ type: 'task', bureau, task: t });
        }
      }

      const knownTeamIds = new Set(bureau.teams.map((tm) => tm.id));
      const orphanTasks = bTasks.filter((t) => !knownTeamIds.has(t.teamId));
      if (orphanTasks.length > 0 && !selectedTeamId) {
        result.push({
          type: 'sub',
          key: `${bureau.id}-other`,
          title: 'その他・担当未分類',
          count: orphanTasks.length,
        });
        for (const t of orphanTasks) {
          result.push({ type: 'task', bureau, task: t });
        }
      }
    }
    return result;
  }, [
    groupBy,
    initiatives,
    bureaus,
    bureauById,
    filteredTasks,
    selectedBureauId,
    selectedTeamId,
    selectedInitiativeId,
    collapsedGroups,
    search,
    stageFilter,
    onlyUnverifiedOrLate,
  ]);

  const toggleCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const monthSpans = useMemo(() => {
    const spans: { label: string; count: number }[] = [];
    for (const d of daysList) {
      const [y, m] = d.split('-');
      const label = `${y}年${parseInt(m, 10)}月`;
      if (spans.length === 0 || spans[spans.length - 1].label !== label) {
        spans.push({ label, count: 1 });
      } else {
        spans[spans.length - 1].count += 1;
      }
    }
    return spans;
  }, [daysList]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setGroupBy('initiative')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                groupBy === 'initiative'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              プロジェクト別
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('bureau')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                groupBy === 'bureau'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              局・担当別
            </button>
          </div>

          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="タスク名・担当で検索..."
              className="pl-8 pr-3 py-1.5 w-48 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <CustomSelect
            value={stageFilter}
            options={[
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
            ]}
            onChange={setStageFilter}
            ariaLabel="進捗段階で絞り込み"
            className="bg-slate-50 min-w-[155px]"
          />

          <button
            type="button"
            onClick={() => setOnlyUnverifiedOrLate((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              onlyUnverifiedOrLate
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            要確認・期限超過のみ
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={scrollToToday}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Target className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>今日 ({formatShortJP(today)})</span>
          </button>

          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            {(
              [
                { id: 'day', label: '日別' },
                { id: 'week', label: '週別' },
                { id: 'month', label: '月全体' },
              ] as { id: ZoomScale; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setZoom(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  zoom === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split Gantt Body */}
      {rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500">
          条件に一致するプロジェクト・タスクがありません。
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sticky Hierarchy Column */}
          <div className="w-72 sm:w-88 shrink-0 border-r border-slate-200 bg-white z-10">
            <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="text-xs font-semibold text-slate-700">
                {groupBy === 'initiative' ? 'プロジェクト / 担当タスク' : '局 / 担当 / タスク'}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                段階 · 進捗
              </span>
            </div>

            <div>
              {rows.map((row) => {
                if (row.type === 'group') {
                  const palette = BUREAU_COLORS[row.colorKey] || BUREAU_COLORS.slate;
                  const isCollapsed = collapsedGroups[row.groupId];
                  return (
                    <div
                      key={`left-g-${row.groupId}`}
                      className="h-11 px-3 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleCollapse(row.groupId)}
                          aria-label={`${row.title}を展開または折りたたみ`}
                          className="p-0.5 text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span
                          className={`w-2.5 h-2.5 rounded-xs shrink-0 ${palette.swatch}`}
                          aria-hidden="true"
                        />
                        {row.initiative ? (
                          <button
                            type="button"
                            onClick={() => onSelectInitiative(row.initiative!)}
                            className="text-xs font-bold text-slate-900 hover:text-blue-700 truncate text-left cursor-pointer"
                            title={row.title}
                          >
                            {row.title}
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {row.title}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {row.initiative && (!canEditInitiative || canEditInitiative(row.initiative.id)) && (
                          <button
                            type="button"
                            onClick={() => onAddTaskToInitiative(row.initiative!.id)}
                            title={`${row.title}に担当タスクを追加`}
                            className="p-1 text-slate-500 hover:text-blue-700 hover:bg-white rounded cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-700">
                          {row.avg}%
                        </span>
                      </div>
                    </div>
                  );
                }

                if (row.type === 'sub') {
                  return (
                    <div
                      key={`left-sub-${row.key}`}
                      className="h-9 px-4 pl-8 border-b border-slate-100 bg-white flex items-center justify-between gap-2"
                    >
                      <span className="text-[11px] font-semibold text-slate-500 truncate">
                        {row.title}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                        {row.count}件
                      </span>
                    </div>
                  );
                }

                const t = row.task;
                const stage = stageById.get(t.stageId);
                const taskDeadline = getEffectiveDeadline(t);
                const isLate = taskDeadline < today && t.progressPercent < 100;
                const teamObj = row.bureau?.teams.find((tm) => tm.id === t.teamId);

                return (
                  <button
                    key={`left-t-${t.id}`}
                    type="button"
                    onClick={() => onSelectTask(t)}
                    className="w-full h-11 px-4 pl-7 border-b border-slate-100 hover:bg-blue-50/40 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {t.isMilestone && (
                          <Diamond
                            className="w-3 h-3 text-blue-700 fill-blue-100 shrink-0"
                            aria-label="マイルストーン"
                          />
                        )}
                        <span
                          className={`text-xs truncate ${
                            isLate ? 'text-red-700 font-medium' : 'text-slate-800'
                          }`}
                          title={t.title}
                        >
                          {t.title}
                        </span>
                      </div>
                      {groupBy === 'initiative' && row.bureau && (
                        <p className="text-[10px] text-slate-500 truncate">
                          {row.bureau.shortName}
                          {teamObj ? ` · ${teamObj.name}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.isVerified && (
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-emerald-600"
                          aria-label="確認済"
                        />
                      )}
                      <span className="text-[11px] text-slate-500 hidden sm:inline truncate max-w-[68px]">
                        {stage?.name || ''}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-700 w-8 text-right">
                        {t.progressPercent}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Scrollable Timeline Canvas */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto gantt-scroll relative bg-white">
            <div style={{ width: `${totalWidth}px` }} className="relative">
              <div className="h-14 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                <div className="h-6 flex border-b border-slate-200">
                  {monthSpans.map((m, idx) => (
                    <div
                      key={`${m.label}-${idx}`}
                      style={{ width: `${m.count * dayWidth}px` }}
                      className="px-2 flex items-center text-[11px] font-semibold text-slate-700 border-r border-slate-200 truncate"
                    >
                      {m.label}
                    </div>
                  ))}
                </div>

                <div className="h-8 flex">
                  {daysList.map((dStr) => {
                    const dayNum = parseInt(dStr.slice(8, 10), 10);
                    const weekday = getWeekdayJP(dStr);
                    const isWeekend = weekday === '土' || weekday === '日';
                    const isToday = dStr === today;
                    const isFestival =
                      dStr >= project.festivalDate && dStr <= project.festivalEndDate;

                    const showLabel =
                      zoom === 'day' ||
                      (zoom === 'week' && (weekday === '月' || isToday || isFestival)) ||
                      (zoom === 'month' && (dayNum === 1 || dayNum === 15 || isToday));

                    return (
                      <div
                        key={dStr}
                        style={{ width: `${dayWidth}px` }}
                        className={`shrink-0 border-r border-slate-200/70 flex flex-col items-center justify-center text-[10px] font-mono tabular-nums ${
                          isToday
                            ? 'bg-blue-600 text-white font-bold'
                            : isFestival
                              ? 'bg-amber-100 text-amber-900 font-bold'
                              : isWeekend
                                ? 'bg-slate-100/80 text-slate-500'
                                : 'text-slate-600'
                        }`}
                      >
                        {showLabel && (
                          <>
                            <span>{dayNum}</span>
                            {zoom === 'day' && <span className="text-[9px] opacity-80">{weekday}</span>}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex pointer-events-none">
                  {daysList.map((dStr) => {
                    const weekday = getWeekdayJP(dStr);
                    const isWeekend = weekday === '土' || weekday === '日';
                    const isToday = dStr === today;
                    const isFestival =
                      dStr >= project.festivalDate && dStr <= project.festivalEndDate;
                    return (
                      <div
                        key={`bg-${dStr}`}
                        style={{ width: `${dayWidth}px` }}
                        className={`h-full border-r border-slate-100 shrink-0 ${
                          isFestival
                            ? 'bg-amber-50/60'
                            : isToday
                              ? 'bg-blue-50/40'
                              : isWeekend
                                ? 'bg-slate-50/60'
                                : ''
                        }`}
                      />
                    );
                  })}
                </div>

                {todayOffsetDays >= 0 && todayOffsetDays < daysList.length && (
                  <div
                    style={{ left: `${todayOffsetDays * dayWidth + dayWidth / 2}px` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-600/80 pointer-events-none z-10"
                  />
                )}

                {rows.map((row) => {
                  if (row.type === 'group') {
                    const palette = BUREAU_COLORS[row.colorKey] || BUREAU_COLORS.slate;
                    const hasSpan = row.minStart && row.maxEnd;
                    const startIdx = hasSpan ? diffDays(timelineStart, row.minStart!) : 0;
                    const spanDays = hasSpan
                      ? Math.max(1, diffDays(row.minStart!, row.maxEnd!) + 1)
                      : 0;
                    const initDeadline = row.initiative?.deadlineDate || '';
                    const initDeadlineIdx = initDeadline
                      ? diffDays(timelineStart, initDeadline)
                      : -1;

                    return (
                      <div
                        key={`right-g-${row.groupId}`}
                        className="h-11 border-b border-slate-200 bg-slate-50/50 relative flex items-center"
                      >
                        {hasSpan && (
                          <div
                            style={{
                              left: `${startIdx * dayWidth}px`,
                              width: `${spanDays * dayWidth}px`,
                            }}
                            className="absolute h-3 rounded-sm bg-slate-200/90 border border-slate-300 overflow-hidden"
                            title={`${row.title} 進捗 ${row.avg}%`}
                          >
                            <div
                              className={`h-full ${palette.barFill} opacity-75`}
                              style={{ width: `${row.avg}%` }}
                            />
                          </div>
                        )}
                        {initDeadline && initDeadlineIdx >= 0 && (
                          <div
                            style={{
                              left: `${initDeadlineIdx * dayWidth + dayWidth / 2 - 9}px`,
                            }}
                            title={`${row.title} 締切: ${formatShortJP(initDeadline)}`}
                            className="absolute z-10 w-[18px] h-[18px] rounded bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs pointer-events-none"
                          >
                            〆
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (row.type === 'sub') {
                    return (
                      <div
                        key={`right-sub-${row.key}`}
                        className="h-9 border-b border-slate-100 relative"
                      />
                    );
                  }

                  const t = row.task;
                  const palette = BUREAU_COLORS[row.bureau?.colorKey || 'slate'] || BUREAU_COLORS.slate;
                  const stage = stageById.get(t.stageId);
                  const tone = stage ? STAGE_TONES[stage.tone] : STAGE_TONES.neutral;
                  const startIdx = diffDays(timelineStart, t.startDate);
                  const durationDays = Math.max(1, diffDays(t.startDate, t.endDate) + 1);
                  const leftPx = startIdx * dayWidth + 2;
                  const widthPx = Math.max(dayWidth - 4, durationDays * dayWidth - 4);
                  const effectiveDeadline = getEffectiveDeadline(t);
                  const deadlineOnly = isDeadlineOnlyItem(t);
                  const isLate = effectiveDeadline < today && t.progressPercent < 100;
                  const hasSeparateDeadline = Boolean(
                    t.deadlineDate && !deadlineOnly && t.deadlineDate !== t.endDate
                  );
                  const deadlineIdx = diffDays(timelineStart, effectiveDeadline);
                  const deadlinePinCenterPx = deadlineIdx * dayWidth + dayWidth / 2;

                  if (deadlineOnly) {
                    return (
                      <div
                        key={`right-t-${t.id}`}
                        className="h-11 border-b border-slate-100 relative flex items-center"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectTask(t)}
                          style={{ left: `${deadlineIdx * dayWidth + 2}px` }}
                          title={`〆 ${t.title}｜締め切り日 ${formatShortJP(effectiveDeadline)} (${t.progressPercent}%)`}
                          className={`absolute h-7 px-2 rounded-md border flex items-center gap-1.5 text-left transition-transform hover:scale-[1.01] cursor-pointer whitespace-nowrap z-10 ${
                            t.progressPercent >= 100
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                              : isLate
                                ? 'bg-red-50 border-red-400 text-red-900'
                                : 'bg-amber-50 border-amber-400 text-slate-900'
                          }`}
                        >
                          <span
                            className={`px-1 py-0.5 rounded text-[10px] font-bold leading-none ${
                              t.progressPercent >= 100
                                ? 'bg-emerald-600 text-white'
                                : isLate
                                  ? 'bg-red-600 text-white'
                                  : 'bg-amber-600 text-white'
                            }`}
                          >
                            〆
                          </span>
                          {t.isMilestone && (
                            <Diamond
                              className="w-3 h-3 text-blue-800 fill-blue-200 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span className="text-[11px] font-semibold max-w-[160px] truncate">
                            {t.title}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums opacity-80">
                            {t.progressPercent}%
                          </span>
                        </button>
                      </div>
                    );
                  }

                  const barEndRightPx = leftPx + widthPx;
                  const connectorLeft = Math.min(barEndRightPx, deadlinePinCenterPx);
                  const connectorWidth = Math.max(0, Math.abs(deadlinePinCenterPx - barEndRightPx));

                  return (
                    <div
                      key={`right-t-${t.id}`}
                      className="h-11 border-b border-slate-100 relative flex items-center"
                    >
                      {hasSeparateDeadline && connectorWidth > 2 && (
                        <div
                          style={{
                            left: `${connectorLeft}px`,
                            width: `${connectorWidth}px`,
                          }}
                          className={`absolute h-0.5 border-t border-dashed pointer-events-none ${
                            isLate ? 'border-red-400' : 'border-amber-500'
                          }`}
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectTask(t)}
                        style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                        title={`${t.title}｜${stage?.name || ''} (${t.progressPercent}%)｜${formatShortJP(t.startDate)}〜${formatShortJP(t.endDate)}${
                          t.deadlineDate ? `｜〆${formatShortJP(t.deadlineDate)}` : ''
                        }`}
                        className={`absolute h-7 rounded-md border overflow-hidden flex items-center text-left transition-transform hover:scale-[1.01] cursor-pointer ${
                          isLate ? 'bg-red-50 border-red-400' : `${palette.barBg}`
                        }`}
                      >
                        <div
                          style={{ width: `${t.progressPercent}%` }}
                          className={`absolute inset-y-0 left-0 ${
                            isLate ? 'bg-red-500/25' : `${tone.barClass} opacity-30`
                          }`}
                        />
                        <div
                          style={{ width: `${t.progressPercent}%` }}
                          className={`absolute bottom-0 left-0 h-1 ${
                            isLate ? 'bg-red-600' : palette.barFill
                          }`}
                        />

                        <div className="relative z-10 px-2 flex items-center justify-between gap-1.5 w-full min-w-0">
                          <span className="flex items-center gap-1 min-w-0">
                            {t.isMilestone && (
                              <Diamond
                                className="w-3 h-3 text-blue-800 fill-blue-200 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <span className="text-[11px] font-medium text-slate-900 truncate">
                              {t.title}
                            </span>
                          </span>
                          {widthPx >= 95 && (
                            <span className="text-[10px] font-mono tabular-nums font-semibold text-slate-800 shrink-0">
                              {t.progressPercent}%
                            </span>
                          )}
                        </div>
                      </button>

                      {hasSeparateDeadline && (
                        <button
                          type="button"
                          onClick={() => onSelectTask(t)}
                          style={{ left: `${deadlinePinCenterPx - 10}px` }}
                          title={`締め切り日: ${formatShortJP(effectiveDeadline)} (${t.title})`}
                          className={`absolute z-10 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shadow-xs cursor-pointer ${
                            t.progressPercent >= 100
                              ? 'bg-emerald-600 text-white'
                              : isLate
                                ? 'bg-red-600 text-white'
                                : 'bg-amber-600 text-white'
                          }`}
                        >
                          〆
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Legend */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-600 inline-block" />
            <span>本日</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-amber-100 border border-amber-300 inline-block rounded-xs" />
            <span>
              大学祭本番期間 ({formatShortJP(project.festivalDate)}〜{formatShortJP(project.festivalEndDate)})
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <Diamond className="w-3 h-3 text-blue-700 fill-blue-100" />
            <span>マイルストーン</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1 rounded bg-amber-600 text-white text-[10px] font-bold">〆</span>
            <span>締め切り日</span>
          </span>
        </div>
        <span className="text-slate-500">
          タスクのバーをクリックすると資料添付・進捗確認ダッシュボードを開きます
        </span>
      </div>
    </div>
  );
};
