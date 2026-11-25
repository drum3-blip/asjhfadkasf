import React, { useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  GanttChartSquare,
  Globe,
  ListChecks,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Settings2,
  UserPlus,
} from 'lucide-react';
import { Bureau, BUREAU_COLORS, FestivalTask, Initiative, Project, ViewMode } from '../types';
import { CustomSelect } from './CustomSelect';

interface SidebarProps {
  projects: Project[];
  activeProject: Project | null;
  isBoardOwner: boolean;
  isGuest?: boolean;
  publicLinkActive?: boolean;
  onSelectProject: (projectId: string) => void;
  onCreateProjectClick: () => void;
  onEditBoardClick: () => void;
  onJoinInviteClick: () => void;
  onOpenPublicLinkSettings?: () => void;
  pendingInvitesCount?: number;
  viewMode: ViewMode;
  onChangeView: (view: ViewMode) => void;
  bureaus: Bureau[];
  initiatives: Initiative[];
  tasks: FestivalTask[];
  selectedBureauId: string | null;
  selectedTeamId: string | null;
  selectedInitiativeId: string | null;
  onSelectFilter: (
    bureauId: string | null,
    teamId: string | null,
    initiativeId: string | null
  ) => void;
  onCreateInitiativeClick: () => void;
  onOpenSettings: () => void;
  userDisplayName: string;
  onUpdateGuestName?: (name: string) => void;
  onGoogleSignInClick?: () => void;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  activeProject,
  isBoardOwner,
  isGuest = false,
  publicLinkActive = false,
  onSelectProject,
  onCreateProjectClick,
  onEditBoardClick,
  onJoinInviteClick,
  onOpenPublicLinkSettings,
  pendingInvitesCount = 0,
  viewMode,
  onChangeView,
  bureaus,
  initiatives,
  tasks,
  selectedBureauId,
  selectedTeamId,
  selectedInitiativeId,
  onSelectFilter,
  onCreateInitiativeClick,
  onOpenSettings,
  userDisplayName,
  onUpdateGuestName,
  onGoogleSignInClick,
  onSignOut,
}) => {
  const [expandedBureaus, setExpandedBureaus] = useState<Record<string, boolean>>({});
  const [editingGuestName, setEditingGuestName] = useState(false);
  const [guestNameDraft, setGuestNameDraft] = useState(userDisplayName);

  const toggleExpand = (bureauId: string) => {
    setExpandedBureaus((prev) => ({ ...prev, [bureauId]: !prev[bureauId] }));
  };

  const activeTasks = tasks.filter((t) => t.status === 'active');

  const navItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: '全体状況・プロジェクト', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'gantt', label: 'ガントチャート', icon: <GanttChartSquare className="w-4 h-4" /> },
    { id: 'calendar', label: '全体カレンダー', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'list', label: 'タスク一覧・進捗入力', icon: <ListChecks className="w-4 h-4" /> },
  ];

  const isAllClear =
    selectedBureauId === null && selectedTeamId === null && selectedInitiativeId === null;

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full select-none">
      {/* Brand + Board Switcher + Edit/Delete/Create */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-slate-900 tracking-tight whitespace-nowrap truncate">
            実行委員会 進捗ボード
          </span>
        </div>

        <div className="mt-3">
          <label htmlFor="project-switcher" className="sr-only">
            実行委員会ボード切り替え
          </label>
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <CustomSelect
                id="project-switcher"
                value={activeProject?.id || ''}
                options={projects.map((p) => ({
                  value: p.id,
                  label: p.isShared ? `${p.name} (共有)` : p.name,
                }))}
                onChange={onSelectProject}
                ariaLabel="実行委員会ボード切り替え"
                className="w-full bg-slate-50 font-medium"
              />
            </div>
            {isBoardOwner && (
              <button
                type="button"
                onClick={onEditBoardClick}
                title="現在のボードを編集・削除"
                aria-label="現在のボードを編集・削除"
                className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
            {!isGuest && (
              <button
                type="button"
                onClick={onCreateProjectClick}
                title="新しいボードを作成"
                aria-label="新しいボードを作成"
                className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          {activeProject && (
            <p className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
              本番 {activeProject.festivalDate} 〜 {activeProject.festivalEndDate}
              {!isBoardOwner ? (isGuest ? ' · リンク参加中' : ' · 共有参加中') : ''}
            </p>
          )}
        </div>
      </div>

      {/* Primary View Navigation */}
      <nav className="p-3 border-b border-slate-200 space-y-1" aria-label="メインビュー">
        {navItems.map((item) => {
          const isActive = viewMode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-blue-50 text-blue-800 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className={isActive ? 'text-blue-700' : 'text-slate-500'}>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Scrollable Filters: Projects + Bureaus/Teams */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <button
          type="button"
          onClick={() => onSelectFilter(null, null, null)}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
            isAllClear
              ? 'bg-slate-900 text-white font-medium'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <FolderKanban className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">すべて表示</span>
          </span>
          <span className="font-mono text-[11px] tabular-nums opacity-80">{activeTasks.length}</span>
        </button>

        {/* Cross-Team Projects Filter */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold text-slate-500">プロジェクト別</span>
            {isBoardOwner && (
              <button
                type="button"
                onClick={onCreateInitiativeClick}
                title="新規プロジェクトを作成"
                aria-label="新規プロジェクトを作成"
                className="p-0.5 text-slate-500 hover:text-blue-700 rounded cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {initiatives.length === 0 ? (
            <p className="px-2 text-[11px] text-slate-400">未登録</p>
          ) : (
            <div className="space-y-0.5">
              {initiatives.map((init) => {
                const count = activeTasks.filter((t) => t.initiativeId === init.id).length;
                const isSelected = selectedInitiativeId === init.id;
                const palette = BUREAU_COLORS[init.colorKey] || BUREAU_COLORS.slate;
                return (
                  <button
                    key={init.id}
                    type="button"
                    onClick={() => onSelectFilter(null, null, init.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-xs shrink-0 ${palette.swatch}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{init.name}</span>
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-400 ml-1 shrink-0">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bureaus & Sub-teams Filter */}
        <div className="space-y-1 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold text-slate-500">局・担当別</span>
          </div>

          <div className="space-y-0.5">
            {bureaus.map((bureau) => {
              const bureauTasks = activeTasks.filter((t) => t.bureauId === bureau.id);
              const isSelectedBureau =
                selectedBureauId === bureau.id &&
                selectedTeamId === null &&
                selectedInitiativeId === null;
              const isExpanded = expandedBureaus[bureau.id] ?? selectedBureauId === bureau.id;
              const palette = BUREAU_COLORS[bureau.colorKey] || BUREAU_COLORS.slate;

              return (
                <div key={bureau.id}>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => toggleExpand(bureau.id)}
                      aria-label={`${bureau.name}の担当を展開`}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectFilter(bureau.id, null, null)}
                      className={`flex-1 min-w-0 flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                        isSelectedBureau
                          ? 'bg-blue-50 text-blue-800 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-xs shrink-0 ${palette.swatch}`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{bureau.name}</span>
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-slate-400 ml-1 shrink-0">
                        {bureauTasks.length}
                      </span>
                    </button>
                  </div>

                  {isExpanded && bureau.teams.length > 0 && (
                    <div className="ml-5 pl-2 border-l border-slate-200 mt-0.5 space-y-0.5">
                      {bureau.teams.map((team) => {
                        const teamTasks = bureauTasks.filter((t) => t.teamId === team.id);
                        const isTeamSelected =
                          selectedBureauId === bureau.id &&
                          selectedTeamId === team.id &&
                          selectedInitiativeId === null;
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => onSelectFilter(bureau.id, team.id, null)}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                              isTeamSelected
                                ? 'bg-blue-50 text-blue-800 font-semibold'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            <span className="truncate">{team.name}</span>
                            <span className="font-mono tabular-nums text-slate-400 ml-1 shrink-0">
                              {teamTasks.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Settings & User Profile */}
      <div className="p-3 border-t border-slate-200 space-y-1.5 bg-slate-50/70">
        <button
          type="button"
          onClick={onJoinInviteClick}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-blue-800 hover:bg-white border border-transparent hover:border-blue-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          <span className="flex items-center gap-2 truncate">
            <UserPlus className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {isGuest ? '個別招待リンクを開く' : '招待コードで参加'}
            </span>
          </span>
          {pendingInvitesCount > 0 && (
            <span className="font-mono text-[11px] font-bold text-blue-700 shrink-0">
              {pendingInvitesCount}
            </span>
          )}
        </button>

        {isBoardOwner && onOpenPublicLinkSettings && (
          <button
            type="button"
            onClick={onOpenPublicLinkSettings}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span className="flex items-center gap-2 truncate">
              <Globe className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
              <span className="truncate">公開リンク設定 (URL)</span>
            </span>
            <span
              className={`text-[10px] font-semibold shrink-0 ${
                publicLinkActive ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              {publicLinkActive ? 'ON' : 'OFF'}
            </span>
          </button>
        )}

        {isBoardOwner && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Settings2 className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>ボード・組織・段階の設定</span>
          </button>
        )}

        {isGuest ? (
          <div className="pt-1 space-y-1.5">
            {editingGuestName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateGuestName?.(guestNameDraft.trim() || '実行委員（ゲスト）');
                  setEditingGuestName(false);
                }}
                className="flex items-center gap-1 px-1"
              >
                <input
                  type="text"
                  maxLength={40}
                  value={guestNameDraft}
                  onChange={(e) => setGuestNameDraft(e.target.value)}
                  placeholder="表示名"
                  className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900"
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-blue-700 text-white text-[11px] font-semibold rounded cursor-pointer shrink-0"
                >
                  保存
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => {
                    setGuestNameDraft(userDisplayName);
                    setEditingGuestName(true);
                  }}
                  title="表示名を変更"
                  className="text-xs text-slate-700 hover:text-blue-700 truncate max-w-[140px] flex items-center gap-1 cursor-pointer"
                >
                  <span className="truncate">{userDisplayName}</span>
                  <Pencil className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                </button>
                {onGoogleSignInClick && (
                  <button
                    type="button"
                    onClick={onGoogleSignInClick}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 px-1.5 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>管理者ログイン</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 pt-1">
            <span className="text-xs text-slate-600 truncate max-w-[160px]" title={userDisplayName}>
              {userDisplayName}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              title="サインアウト"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 px-1.5 py-1 rounded hover:bg-slate-200/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>ログアウト</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
