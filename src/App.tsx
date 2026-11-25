import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { CheckCircle2, FolderPlus, Globe, LogIn, Mail, Menu, Plus, X } from 'lucide-react';
import { auth, googleProvider, testFirestoreConnection } from './firebase';
import {
  acceptProjectInvite,
  ensureDefaultPublicEntry,
  ensureDefaultStages,
  extractInviteCode,
  getInviteByCode,
  leaveSharedInitiative,
  removeStaleJoinedBookmark,
  subscribeToInviteGuestWorkspace,
  subscribeToJoinedInitiatives,
  subscribeToPendingEmailInvites,
  subscribeToProjectData,
  subscribeToProjects,
  subscribeToPublicBoardGuestWorkspace,
  subscribeToPublicEntry,
  subscribeToSharedBoardWorkspace,
  syncBoardPublicShareMetadata,
  toggleTaskVerification,
  updateTaskQuickProgress,
} from './services/firestoreService';
import {
  Bureau,
  FestivalTask,
  Initiative,
  InviteAccessRole,
  JoinedInitiative,
  ProgressStage,
  Project,
  ProjectInvite,
  PublicEntry,
  ShareRole,
  ViewMode,
} from './types';
import { AuthGate } from './components/AuthGate';
import { DashboardSummary } from './components/DashboardSummary';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GanttChartView } from './components/GanttChartView';
import { InitiativeDetailDrawer } from './components/InitiativeDetailDrawer';
import { InitiativeModal } from './components/InitiativeModal';
import { InitiativeShareModal } from './components/InitiativeShareModal';
import { InviteJoinModal } from './components/InviteJoinModal';
import { MasterCalendarView } from './components/MasterCalendarView';
import { OrgAndStagesModal, SettingsTabKey } from './components/OrgAndStagesModal';
import { ProjectSetupScreen } from './components/ProjectSetupScreen';
import { PublicLinkShareModal } from './components/PublicLinkShareModal';
import { Sidebar } from './components/Sidebar';
import { TaskCreateModal } from './components/TaskCreateModal';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { TaskListView } from './components/TaskListView';

const INVITE_STORAGE_KEY = 'fest_pending_invite_code';
const GUEST_NAME_STORAGE_KEY = 'fest_guest_display_name';

interface SharedBoardState {
  project: Project;
  bureaus: Bureau[];
  stages: ProgressStage[];
  initiatives: Initiative[];
  tasks: FestivalTask[];
  roles: Record<string, InviteAccessRole>;
}

interface GuestWorkspaceState {
  project: Project;
  bureaus: Bureau[];
  stages: ProgressStage[];
  initiatives: Initiative[];
  tasks: FestivalTask[];
}

function readInitialInviteCode(): string | null {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('invite');
    if (param) {
      const code = extractInviteCode(param);
      if (code) {
        sessionStorage.setItem(INVITE_STORAGE_KEY, code);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        return code;
      }
    }
    return sessionStorage.getItem(INVITE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function WorkspaceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [ownedProjects, setOwnedProjects] = useState<Project[]>([]);
  const [ownedProjectsLoaded, setOwnedProjectsLoaded] = useState(false);
  const [joinedInitiatives, setJoinedInitiatives] = useState<JoinedInitiative[]>([]);
  const [joinedLoaded, setJoinedLoaded] = useState(false);
  const [pendingEmailInvites, setPendingEmailInvites] = useState<ProjectInvite[]>([]);

  const [sharedBoardsMap, setSharedBoardsMap] = useState<Record<string, SharedBoardState>>({});
  const [settledSharedBoardIds, setSettledSharedBoardIds] = useState<Record<string, boolean>>({});

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [ownedBureaus, setOwnedBureaus] = useState<Bureau[]>([]);
  const [ownedInitiatives, setOwnedInitiatives] = useState<Initiative[]>([]);
  const [ownedInitiativesLoaded, setOwnedInitiativesLoaded] = useState(false);
  const [ownedStages, setOwnedStages] = useState<ProgressStage[]>([]);
  const [ownedTasks, setOwnedTasks] = useState<FestivalTask[]>([]);

  // Login-free PublicEntry & Guest Invite state
  const [publicEntry, setPublicEntry] = useState<PublicEntry | null>(null);
  const [publicEntryLoaded, setPublicEntryLoaded] = useState(false);
  const [guestInviteCode, setGuestInviteCode] = useState<string | null>(() =>
    readInitialInviteCode()
  );
  const [guestInviteObj, setGuestInviteObj] = useState<ProjectInvite | null>(null);
  const [guestWorkspace, setGuestWorkspace] = useState<GuestWorkspaceState | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestErrorMsg, setGuestErrorMsg] = useState<string | null>(null);
  const [guestDisplayName, setGuestDisplayName] = useState<string>(() => {
    try {
      return localStorage.getItem(GUEST_NAME_STORAGE_KEY) || '実行委員（ゲスト）';
    } catch {
      return '実行委員（ゲスト）';
    }
  });

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedBureauId, setSelectedBureauId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);

  const [activeDrawerInitiativeId, setActiveDrawerInitiativeId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [shareInitiativeTarget, setShareInitiativeTarget] = useState<Initiative | null>(null);
  const [publicLinkModalOpen, setPublicLinkModalOpen] = useState(false);

  const [pendingUrlInviteCode, setPendingUrlInviteCode] = useState<string | null>(() =>
    readInitialInviteCode()
  );
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);

  const [taskCreateModalState, setTaskCreateModalState] = useState<{
    open: boolean;
    initiativeId: string | null;
    bureauId: string | null;
    teamId: string | null;
    deadlineDate: string | null;
  }>({ open: false, initiativeId: null, bureauId: null, teamId: null, deadlineDate: null });

  const [initiativeModalState, setInitiativeModalState] = useState<{
    open: boolean;
    target: Initiative | null;
  }>({ open: false, target: null });

  const [settingsModalState, setSettingsModalState] = useState<{
    open: boolean;
    initialTab: SettingsTabKey;
  }>({ open: false, initialTab: 'bureaus' });

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stagesLoadedForProjectId, setStagesLoadedForProjectId] = useState<string | null>(null);
  const [quickErrorMsg, setQuickErrorMsg] = useState<string | null>(null);
  const seededStagesProjectsRef = useRef<Set<string>>(new Set());
  const syncedShareMetaProjectsRef = useRef<Set<string>>(new Set());
  const ensuredPublicEntryRef = useRef<boolean>(false);

  useEffect(() => {
    testFirestoreConnection();
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setOwnedProjects([]);
        setOwnedProjectsLoaded(false);
        setJoinedInitiatives([]);
        setJoinedLoaded(false);
        setPendingEmailInvites([]);
        setSharedBoardsMap({});
        setSettledSharedBoardIds({});
        setActiveProjectId(null);
        setOwnedBureaus([]);
        setOwnedInitiatives([]);
        setOwnedInitiativesLoaded(false);
        setOwnedStages([]);
        setOwnedTasks([]);
      }
    });
    const unsubPublicEntry = subscribeToPublicEntry((entry, loaded) => {
      setPublicEntry(entry);
      setPublicEntryLoaded(loaded);
    });
    return () => {
      unsubAuth();
      unsubPublicEntry();
    };
  }, []);

  // Subscribe to owned boards, joined initiatives, and pending email invites
  useEffect(() => {
    if (!authReady || !user) return;
    setOwnedProjectsLoaded(false);
    setJoinedLoaded(false);

    const unsubOwned = subscribeToProjects(user.uid, (list) => {
      setOwnedProjects(list);
      setOwnedProjectsLoaded(true);
    });

    const unsubJoined = subscribeToJoinedInitiatives(user.uid, (list) => {
      setJoinedInitiatives(list);
      setJoinedLoaded(true);
    });

    const unsubEmailInvites = subscribeToPendingEmailInvites(
      user.email || '',
      setPendingEmailInvites
    );

    return () => {
      unsubOwned();
      unsubJoined();
      unsubEmailInvites();
    };
  }, [authReady, user]);

  // Login-free guest workspace subscription (either ?invite= link OR publicEntry/default)
  const publicEntryKey = publicEntry
    ? `${publicEntry.projectId}|${publicEntry.status}|${publicEntry.accessScope}|${publicEntry.role}|${(
        publicEntry.initiativeIds || []
      ).join(',')}`
    : '';

  useEffect(() => {
    if (!authReady || user) {
      setGuestWorkspace(null);
      setGuestInviteObj(null);
      setGuestLoading(false);
      return;
    }

    if (guestInviteCode) {
      setGuestLoading(true);
      setGuestErrorMsg(null);
      const unsub = subscribeToInviteGuestWorkspace(guestInviteCode, {
        onInvite: (inv) => {
          setGuestInviteObj(inv);
        },
        onSharedConfig: ({ project, bureaus, stages }) => {
          setGuestWorkspace((prev) => ({
            project,
            bureaus,
            stages,
            initiatives: prev?.initiatives || [],
            tasks: prev?.tasks || [],
          }));
          setGuestLoading(false);
        },
        onInitiatives: (initiatives) => {
          setGuestWorkspace((prev) =>
            prev ? { ...prev, initiatives } : null
          );
        },
        onTasks: (tasks) => {
          setGuestWorkspace((prev) => (prev ? { ...prev, tasks } : null));
        },
        onUnavailable: (reason) => {
          setGuestLoading(false);
          setGuestWorkspace(null);
          setGuestInviteObj(null);
          setGuestInviteCode(null);
          try {
            sessionStorage.removeItem(INVITE_STORAGE_KEY);
          } catch {
            // Ignore storage errors
          }
          setGuestErrorMsg(reason || '共有リンクが無効です。');
        },
      });
      return () => unsub();
    }

    if (publicEntry && publicEntry.status === 'active') {
      setGuestLoading(true);
      setGuestErrorMsg(null);
      const unsub = subscribeToPublicBoardGuestWorkspace(publicEntry, {
        onSharedConfig: ({ project, bureaus, stages }) => {
          setGuestWorkspace((prev) => ({
            project,
            bureaus,
            stages,
            initiatives: prev?.initiatives || [],
            tasks: prev?.tasks || [],
          }));
          setGuestLoading(false);
        },
        onInitiatives: (initiatives) => {
          setGuestWorkspace((prev) =>
            prev
              ? { ...prev, initiatives }
              : null
          );
        },
        onTasks: (tasks) => {
          setGuestWorkspace((prev) => (prev ? { ...prev, tasks } : null));
        },
        onUnavailable: () => {
          setGuestLoading(false);
          setGuestWorkspace(null);
        },
      });
      return () => unsub();
    }

    setGuestWorkspace(null);
    setGuestInviteObj(null);
    setGuestLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, guestInviteCode, publicEntryKey]);

  // Open InviteJoinModal automatically if a signed-in user arrived with an ?invite= URL parameter
  useEffect(() => {
    if (authReady && user && pendingUrlInviteCode) {
      setJoinModalOpen(true);
    }
  }, [authReady, user, pendingUrlInviteCode]);

  const ownedProjectIdSet = useMemo(
    () => new Set(ownedProjects.map((p) => p.id)),
    [ownedProjects]
  );

  // Group joined shared initiatives by board (excluding boards owned by this user)
  const sharedJoinedByBoard = useMemo(() => {
    const grouped: Record<string, JoinedInitiative[]> = {};
    for (const j of joinedInitiatives) {
      if (ownedProjectIdSet.has(j.projectId)) continue;
      if (!grouped[j.projectId]) grouped[j.projectId] = [];
      grouped[j.projectId].push(j);
    }
    return grouped;
  }, [joinedInitiatives, ownedProjectIdSet]);

  const sharedBoardSignature = useMemo(() => {
    return Object.entries(sharedJoinedByBoard)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([boardId, items]) =>
          `${boardId}:${items
            .map((i) => i.initiativeId)
            .sort()
            .join(',')}`
      )
      .join('|');
  }, [sharedJoinedByBoard]);

  // Subscribe to each shared board's config + only the shared initiatives & tasks
  useEffect(() => {
    if (!authReady || !user) return;
    const entries = Object.entries(sharedJoinedByBoard);
    if (entries.length === 0) {
      setSharedBoardsMap({});
      setSettledSharedBoardIds({});
      return;
    }

    const activeIds = new Set(entries.map(([id]) => id));
    setSharedBoardsMap((prev) => {
      const next: Record<string, SharedBoardState> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (activeIds.has(k)) next[k] = v;
      }
      return next;
    });

    const unsubs: (() => void)[] = [];
    for (const [boardId, items] of entries) {
      const unsub = subscribeToSharedBoardWorkspace(user.uid, boardId, items, {
        onSharedConfig: ({ project, bureaus, stages }) => {
          setSharedBoardsMap((prev) => ({
            ...prev,
            [boardId]: {
              project,
              bureaus,
              stages,
              initiatives: prev[boardId]?.initiatives || [],
              tasks: prev[boardId]?.tasks || [],
              roles: prev[boardId]?.roles || {},
            },
          }));
          setSettledSharedBoardIds((prev) => ({ ...prev, [boardId]: true }));
        },
        onInitiatives: (initiatives) => {
          setSharedBoardsMap((prev) => {
            if (!prev[boardId]) return prev;
            return { ...prev, [boardId]: { ...prev[boardId], initiatives } };
          });
        },
        onTasks: (tasks) => {
          setSharedBoardsMap((prev) => {
            if (!prev[boardId]) return prev;
            return { ...prev, [boardId]: { ...prev[boardId], tasks } };
          });
        },
        onMemberRoles: (roles) => {
          setSharedBoardsMap((prev) => {
            if (!prev[boardId]) return prev;
            return { ...prev, [boardId]: { ...prev[boardId], roles } };
          });
        },
        onStaleJoined: (stale) => {
          setSettledSharedBoardIds((prev) => ({ ...prev, [boardId]: true }));
          removeStaleJoinedBookmark(user.uid, stale.id);
        },
      });
      unsubs.push(unsub);
    }

    return () => {
      for (const u of unsubs) u();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, sharedBoardSignature]);

  const allProjects = useMemo(() => {
    const shared = Object.values(sharedBoardsMap)
      .map((entry) => entry.project)
      .filter((p) => !ownedProjectIdSet.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...ownedProjects, ...shared];
  }, [ownedProjects, sharedBoardsMap, ownedProjectIdSet]);

  useEffect(() => {
    setActiveProjectId((prev) => {
      if (prev && allProjects.some((p) => p.id === prev)) return prev;
      return allProjects[0]?.id || null;
    });
  }, [allProjects]);

  const isGuestMode = !user && Boolean(guestWorkspace);

  const activeProject = useMemo(() => {
    if (!user) return guestWorkspace?.project || null;
    return allProjects.find((p) => p.id === activeProjectId) || null;
  }, [user, guestWorkspace, allProjects, activeProjectId]);

  const effectiveProjectsList = useMemo(() => {
    if (!user) return guestWorkspace?.project ? [guestWorkspace.project] : [];
    return allProjects;
  }, [user, guestWorkspace, allProjects]);

  const isBoardOwner = Boolean(activeProject && user && activeProject.ownerId === user.uid);

  // Subscribe to owned board details only when the active board is owned by current user
  useEffect(() => {
    if (!authReady || !user || !activeProjectId || !isBoardOwner) {
      setOwnedBureaus([]);
      setOwnedInitiatives([]);
      setOwnedInitiativesLoaded(false);
      setOwnedStages([]);
      setOwnedTasks([]);
      setStagesLoadedForProjectId(null);
      return;
    }
    setStagesLoadedForProjectId(null);
    setOwnedInitiativesLoaded(false);
    const unsub = subscribeToProjectData(user.uid, activeProjectId, {
      onBureaus: setOwnedBureaus,
      onInitiatives: (list) => {
        setOwnedInitiatives(list);
        setOwnedInitiativesLoaded(true);
      },
      onStages: (list) => {
        setOwnedStages(list);
        setStagesLoadedForProjectId(activeProjectId);
      },
      onTasks: setOwnedTasks,
    });
    return () => unsub();
  }, [authReady, user, activeProjectId, isBoardOwner]);

  useEffect(() => {
    if (!user || !activeProjectId || !isBoardOwner) return;
    if (stagesLoadedForProjectId !== activeProjectId) return;
    if (ownedStages.length > 0) return;
    if (seededStagesProjectsRef.current.has(activeProjectId)) return;
    seededStagesProjectsRef.current.add(activeProjectId);
    ensureDefaultStages(user.uid, activeProjectId);
  }, [user, activeProjectId, isBoardOwner, stagesLoadedForProjectId, ownedStages.length]);

  // Keep sharedConfig/workspace, legacy ?invite= publicLinkRole, and default publicEntry synced when owner opens board
  useEffect(() => {
    if (!user || !activeProject || !isBoardOwner || !ownedInitiativesLoaded) return;
    if (!syncedShareMetaProjectsRef.current.has(activeProject.id)) {
      syncedShareMetaProjectsRef.current.add(activeProject.id);
      syncBoardPublicShareMetadata(user.uid, activeProject.id);
    }
    if (publicEntryLoaded && !ensuredPublicEntryRef.current) {
      ensuredPublicEntryRef.current = true;
      const ownerLabel = user.displayName || user.email || 'オーナー';
      ensureDefaultPublicEntry(user.uid, ownerLabel, activeProject, ownedInitiatives);
    }
  }, [user, activeProject, isBoardOwner, ownedInitiativesLoaded, publicEntryLoaded, ownedInitiatives]);

  const sharedWorkspace =
    user && activeProject && !isBoardOwner ? sharedBoardsMap[activeProject.id] : undefined;

  const bureaus = isGuestMode
    ? guestWorkspace?.bureaus || []
    : isBoardOwner
      ? ownedBureaus
      : sharedWorkspace?.bureaus || [];
  const initiatives = isGuestMode
    ? guestWorkspace?.initiatives || []
    : isBoardOwner
      ? ownedInitiatives
      : sharedWorkspace?.initiatives || [];
  const stages = isGuestMode
    ? guestWorkspace?.stages || []
    : isBoardOwner
      ? ownedStages
      : sharedWorkspace?.stages || [];
  const tasks = isGuestMode
    ? guestWorkspace?.tasks || []
    : isBoardOwner
      ? ownedTasks
      : sharedWorkspace?.tasks || [];

  const isPublicBoardEditor = Boolean(
    isGuestMode &&
      !guestInviteCode &&
      publicEntry?.status === 'active' &&
      publicEntry.accessScope === 'board' &&
      publicEntry.role === 'editor'
  );

  const getInitiativeRole = (initiativeId: string): ShareRole | null => {
    if (!activeProject) return null;
    if (isBoardOwner) return 'owner';
    if (isGuestMode) {
      if (guestInviteObj && guestInviteObj.initiativeId === initiativeId) {
        return guestInviteObj.role;
      }
      if (publicEntry?.status === 'active') {
        return publicEntry.role;
      }
      return 'viewer';
    }
    if (!initiativeId) return null;
    const liveRole = sharedWorkspace?.roles?.[initiativeId];
    if (liveRole) return liveRole;
    const bookmark = joinedInitiatives.find(
      (j) => j.projectId === activeProject.id && j.initiativeId === initiativeId
    );
    return bookmark ? bookmark.role : null;
  };

  const canEditInitiative = (initiativeId?: string): boolean => {
    if (isBoardOwner || isPublicBoardEditor) return true;
    if (!initiativeId) return false;
    const role = getInitiativeRole(initiativeId);
    return role === 'owner' || role === 'editor';
  };

  const editableInitiatives = useMemo(
    () => initiatives.filter((i) => canEditInitiative(i.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      initiatives,
      isBoardOwner,
      isGuestMode,
      isPublicBoardEditor,
      guestInviteObj,
      publicEntry,
      sharedWorkspace?.roles,
      joinedInitiatives,
      activeProject?.id,
    ]
  );

  const canCreateAnyTask = isBoardOwner || isPublicBoardEditor || editableInitiatives.length > 0;

  const joinedInitiativeKeys = useMemo(
    () => new Set(joinedInitiatives.map((j) => `${j.projectId}__${j.initiativeId}`)),
    [joinedInitiatives]
  );

  const unjoinedEmailInvites = useMemo(
    () =>
      pendingEmailInvites.filter(
        (inv) => !joinedInitiativeKeys.has(`${inv.projectId}__${inv.initiativeId}`)
      ),
    [pendingEmailInvites, joinedInitiativeKeys]
  );

  const activeDrawerInitiative = useMemo(
    () => initiatives.find((i) => i.id === activeDrawerInitiativeId) || null,
    [initiatives, activeDrawerInitiativeId]
  );

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const selectedBureau = useMemo(
    () => bureaus.find((b) => b.id === selectedBureauId) || null,
    [bureaus, selectedBureauId]
  );

  const selectedTeam = useMemo(
    () => selectedBureau?.teams.find((tm) => tm.id === selectedTeamId) || null,
    [selectedBureau, selectedTeamId]
  );

  const selectedInitiative = useMemo(
    () => initiatives.find((i) => i.id === selectedInitiativeId) || null,
    [initiatives, selectedInitiativeId]
  );

  const resetBoardSelection = () => {
    setSelectedBureauId(null);
    setSelectedTeamId(null);
    setSelectedInitiativeId(null);
    setActiveDrawerInitiativeId(null);
    setSelectedTaskId(null);
  };

  const handleCloseJoinModal = () => {
    setJoinModalOpen(false);
    setPendingUrlInviteCode(null);
    if (user) {
      setGuestInviteCode(null);
    }
    try {
      sessionStorage.removeItem(INVITE_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  const handleJoinedInitiative = (projectId: string, initiativeId: string) => {
    setActiveProjectId(projectId);
    resetBoardSelection();
    setSelectedInitiativeId(initiativeId);
    setActiveDrawerInitiativeId(initiativeId);
    setShowNewProjectModal(false);
    handleCloseJoinModal();
  };

  const handleAcceptBannerInvite = async (invite: ProjectInvite) => {
    if (!user) return;
    setAcceptingInviteId(invite.id);
    setQuickErrorMsg(null);
    try {
      const res = await acceptProjectInvite(user, invite);
      handleJoinedInitiative(res.projectId, res.initiativeId);
    } catch (err) {
      setQuickErrorMsg(err instanceof Error ? err.message : '招待への参加に失敗しました。');
    } finally {
      setAcceptingInviteId(null);
    }
  };

  const handleUpdateGuestName = (nextName: string) => {
    const clean = nextName.trim() || '実行委員（ゲスト）';
    setGuestDisplayName(clean);
    try {
      localStorage.setItem(GUEST_NAME_STORAGE_KEY, clean);
    } catch {
      // Ignore storage errors
    }
  };

  const handleEnterGuestInviteCode = async (rawCodeOrUrl: string): Promise<string | null> => {
    const code = extractInviteCode(rawCodeOrUrl);
    if (!code) return '招待リンクまたはコードを入力してください。';
    const inv = await getInviteByCode(code);
    if (!inv || inv.status !== 'active') {
      return '該当する有効な共有リンクが見つかりません。';
    }
    if (inv.inviteType !== 'link') {
      return 'この招待はGoogleメールアドレス指定のため、上のボタンからGoogleログインしてください。';
    }
    try {
      sessionStorage.setItem(INVITE_STORAGE_KEY, inv.id);
    } catch {
      // Ignore
    }
    setGuestInviteCode(inv.id);
    resetBoardSelection();
    return null;
  };

  const handleExitGuestInviteToPublicBoard = () => {
    setGuestInviteCode(null);
    setGuestInviteObj(null);
    resetBoardSelection();
    try {
      sessionStorage.removeItem(INVITE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleGoogleSignIn = async () => {
    setQuickErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setQuickErrorMsg(
        err instanceof Error ? `サインインに失敗しました: ${err.message}` : 'サインインに失敗しました。'
      );
    }
  };

  const viewTitleMap: Record<ViewMode, string> = {
    dashboard: '全体状況・プロジェクト',
    gantt: 'ガントチャート',
    calendar: '全体カレンダー',
    list: 'タスク一覧・進捗入力',
  };

  if (!authReady || !publicEntryLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xs font-medium text-slate-500">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    if (guestLoading && !guestWorkspace) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <p className="text-xs font-medium text-slate-500">共有ボードを読み込み中...</p>
        </div>
      );
    }
    if (!guestWorkspace) {
      return (
        <AuthGate
          errorMessage={guestErrorMsg}
          onEnterWithInviteCode={handleEnterGuestInviteCode}
        />
      );
    }
  }

  const waitingForSharedSync =
    Boolean(user) &&
    ownedProjectsLoaded &&
    joinedLoaded &&
    ownedProjects.length === 0 &&
    Object.keys(sharedJoinedByBoard).some((id) => !settledSharedBoardIds[id]);

  if (user && (!ownedProjectsLoaded || !joinedLoaded || waitingForSharedSync)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xs font-medium text-slate-500">ボードデータを同期中...</p>
      </div>
    );
  }

  if (user && (allProjects.length === 0 || !activeProject)) {
    return (
      <>
        <ProjectSetupScreen
          uid={user.uid}
          pendingInvitesCount={unjoinedEmailInvites.length}
          onOpenJoinModal={() => setJoinModalOpen(true)}
          onCreated={(newId) => {
            setActiveProjectId(newId);
          }}
        />
        {joinModalOpen && (
          <InviteJoinModal
            user={user}
            initialInviteCode={pendingUrlInviteCode}
            pendingEmailInvites={pendingEmailInvites}
            joinedInitiativeKeys={joinedInitiativeKeys}
            onJoined={handleJoinedInitiative}
            onClose={handleCloseJoinModal}
          />
        )}
      </>
    );
  }

  if (!activeProject) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xs font-medium text-slate-500">ボードデータを読み込み中...</p>
      </div>
    );
  }

  const effectiveUid = user ? user.uid : 'guest_link';
  const userDisplayName = user
    ? user.displayName || user.email || '実行委員'
    : guestDisplayName;
  const isPublicEntryPointingHere = Boolean(
    activeProject &&
      publicEntry &&
      publicEntry.status === 'active' &&
      publicEntry.projectId === activeProject.id
  );

  const openTaskCreateModal = (
    initiativeId?: string | null,
    bureauId?: string | null,
    teamId?: string | null,
    deadlineDate?: string | null
  ) => {
    setTaskCreateModalState({
      open: true,
      initiativeId: initiativeId ?? selectedInitiativeId,
      bureauId: bureauId ?? selectedBureauId,
      teamId: teamId ?? selectedTeamId,
      deadlineDate: deadlineDate ?? null,
    });
  };

  const handleQuickUpdateProgress = async (
    taskId: string,
    stageId: string,
    pct: number
  ) => {
    setQuickErrorMsg(null);
    try {
      await updateTaskQuickProgress(activeProject.id, taskId, stageId, pct);
    } catch {
      setQuickErrorMsg('進捗段階の更新に失敗しました。画面を再読み込みしてご確認ください。');
    }
  };

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* Desktop Left Sidebar */}
      <div className="hidden lg:block h-full">
        <Sidebar
          projects={effectiveProjectsList}
          activeProject={activeProject}
          isBoardOwner={isBoardOwner}
          isGuest={isGuestMode}
          publicLinkActive={isPublicEntryPointingHere}
          onSelectProject={(id) => {
            setActiveProjectId(id);
            resetBoardSelection();
          }}
          onCreateProjectClick={() => setShowNewProjectModal(true)}
          onEditBoardClick={() => setSettingsModalState({ open: true, initialTab: 'project' })}
          onJoinInviteClick={() => setJoinModalOpen(true)}
          onOpenPublicLinkSettings={() => setPublicLinkModalOpen(true)}
          pendingInvitesCount={unjoinedEmailInvites.length}
          viewMode={viewMode}
          onChangeView={setViewMode}
          bureaus={bureaus}
          initiatives={initiatives}
          tasks={tasks}
          selectedBureauId={selectedBureauId}
          selectedTeamId={selectedTeamId}
          selectedInitiativeId={selectedInitiativeId}
          onSelectFilter={(bId, tId, iId) => {
            setSelectedBureauId(bId);
            setSelectedTeamId(tId);
            setSelectedInitiativeId(iId);
          }}
          onCreateInitiativeClick={() => setInitiativeModalState({ open: true, target: null })}
          onOpenSettings={() => setSettingsModalState({ open: true, initialTab: 'bureaus' })}
          userDisplayName={userDisplayName}
          onUpdateGuestName={handleUpdateGuestName}
          onGoogleSignInClick={handleGoogleSignIn}
          onSignOut={() => signOut(auth)}
        />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex bg-slate-900/40"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="h-full relative" onClick={(e) => e.stopPropagation()}>
            <Sidebar
              projects={effectiveProjectsList}
              activeProject={activeProject}
              isBoardOwner={isBoardOwner}
              isGuest={isGuestMode}
              publicLinkActive={isPublicEntryPointingHere}
              onSelectProject={(id) => {
                setActiveProjectId(id);
                resetBoardSelection();
                setMobileMenuOpen(false);
              }}
              onCreateProjectClick={() => {
                setMobileMenuOpen(false);
                setShowNewProjectModal(true);
              }}
              onEditBoardClick={() => {
                setMobileMenuOpen(false);
                setSettingsModalState({ open: true, initialTab: 'project' });
              }}
              onJoinInviteClick={() => {
                setMobileMenuOpen(false);
                setJoinModalOpen(true);
              }}
              onOpenPublicLinkSettings={() => {
                setMobileMenuOpen(false);
                setPublicLinkModalOpen(true);
              }}
              pendingInvitesCount={unjoinedEmailInvites.length}
              viewMode={viewMode}
              onChangeView={(v) => {
                setViewMode(v);
                setMobileMenuOpen(false);
              }}
              bureaus={bureaus}
              initiatives={initiatives}
              tasks={tasks}
              selectedBureauId={selectedBureauId}
              selectedTeamId={selectedTeamId}
              selectedInitiativeId={selectedInitiativeId}
              onSelectFilter={(bId, tId, iId) => {
                setSelectedBureauId(bId);
                setSelectedTeamId(tId);
                setSelectedInitiativeId(iId);
                setMobileMenuOpen(false);
              }}
              onCreateInitiativeClick={() => {
                setMobileMenuOpen(false);
                setInitiativeModalState({ open: true, target: null });
              }}
              onOpenSettings={() => {
                setMobileMenuOpen(false);
                setSettingsModalState({ open: true, initialTab: 'bureaus' });
              }}
              userDisplayName={userDisplayName}
              onUpdateGuestName={handleUpdateGuestName}
              onGoogleSignInClick={handleGoogleSignIn}
              onSignOut={() => signOut(auth)}
            />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="メニューを閉じる"
              className="absolute top-3 right-3 p-1 bg-white border border-slate-200 rounded-md text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="ナビゲーションを開く"
              className="lg:hidden p-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav aria-label="パンくずリスト" className="flex items-center gap-2 text-xs min-w-0">
              <span className="font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-xs">
                {activeProject.name}
                {!isBoardOwner && (
                  <span className="ml-1.5 text-[11px] font-medium text-blue-700">（共有）</span>
                )}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-700 whitespace-nowrap">
                {viewTitleMap[viewMode]}
              </span>
              {selectedInitiative && (
                <>
                  <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                    /
                  </span>
                  <span className="text-blue-700 font-medium hidden sm:inline truncate max-w-[180px]">
                    {selectedInitiative.name}
                  </span>
                </>
              )}
              {selectedBureau && (
                <>
                  <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                    /
                  </span>
                  <span className="text-blue-700 font-medium hidden sm:inline whitespace-nowrap">
                    {selectedBureau.name}
                    {selectedTeam ? ` · ${selectedTeam.name}` : ''}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isGuestMode && guestInviteCode && publicEntry?.status === 'active' && (
              <button
                type="button"
                onClick={handleExitGuestInviteToPublicBoard}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>全体ボードに戻る</span>
              </button>
            )}
            {isGuestMode && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="sm:hidden inline-flex items-center gap-1 px-2.5 py-2 border border-slate-200 bg-white text-blue-700 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                <span>ログイン</span>
              </button>
            )}
            {isBoardOwner && (
              <button
                type="button"
                onClick={() => setPublicLinkModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Globe
                  className={`w-3.5 h-3.5 ${
                    isPublicEntryPointingHere ? 'text-emerald-600' : 'text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span>リンク共有</span>
              </button>
            )}
            {isBoardOwner && (
              <button
                type="button"
                onClick={() => setInitiativeModalState({ open: true, target: null })}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                <span>プロジェクト作成</span>
              </button>
            )}
            {canCreateAnyTask && (
              <button
                type="button"
                onClick={() => openTaskCreateModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>担当タスク追加</span>
              </button>
            )}
          </div>
        </header>

        <div className="lg:hidden px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
          {(
            [
              { id: 'dashboard', label: '全体状況' },
              { id: 'gantt', label: 'ガントチャート' },
              { id: 'calendar', label: 'カレンダー' },
              { id: 'list', label: 'タスク一覧' },
            ] as { id: ViewMode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewMode(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
                viewMode === tab.id
                  ? 'bg-blue-50 text-blue-800 font-semibold'
                  : 'text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Pending Email Invites Banner */}
          {unjoinedEmailInvites.length > 0 && (
            <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Mail className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
                <div className="min-w-0 text-xs">
                  <p className="font-bold text-slate-900 truncate">
                    プロジェクト共有の招待が {unjoinedEmailInvites.length}件 届いています
                  </p>
                  <p className="text-[11px] text-slate-600 truncate">
                    「{unjoinedEmailInvites[0].initiativeName}」（{unjoinedEmailInvites[0].projectName} / 招待者:{' '}
                    {unjoinedEmailInvites[0].ownerName} /{' '}
                    {unjoinedEmailInvites[0].role === 'editor' ? '共同編集' : '閲覧のみ'}）
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={acceptingInviteId === unjoinedEmailInvites[0].id}
                  onClick={() => handleAcceptBannerInvite(unjoinedEmailInvites[0])}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {acceptingInviteId === unjoinedEmailInvites[0].id ? '参加中...' : '参加する'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(true)}
                  className="px-3 py-1.5 bg-white border border-blue-200 hover:bg-blue-100/60 text-blue-800 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  すべて確認
                </button>
              </div>
            </div>
          )}

          {quickErrorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-3">
              <span>{quickErrorMsg}</span>
              <button
                type="button"
                onClick={() => setQuickErrorMsg(null)}
                className="text-red-500 hover:text-red-800 cursor-pointer"
                aria-label="閉じる"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {viewMode === 'dashboard' && (
            <DashboardSummary
              bureaus={bureaus}
              initiatives={initiatives}
              stages={stages}
              tasks={tasks}
              isBoardOwner={isBoardOwner}
              getInitiativeRole={getInitiativeRole}
              selectedBureauId={selectedBureauId}
              selectedTeamId={selectedTeamId}
              selectedInitiativeId={selectedInitiativeId}
              onSelectInitiative={(init) => setActiveDrawerInitiativeId(init.id)}
              onShareInitiative={(init) => setShareInitiativeTarget(init)}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onCreateInitiative={() => setInitiativeModalState({ open: true, target: null })}
              onCreateTaskForInitiative={(initiativeId, bureauId, teamId) =>
                openTaskCreateModal(initiativeId, bureauId || null, teamId || null)
              }
              onQuickUpdateTaskProgress={handleQuickUpdateProgress}
            />
          )}

          {viewMode === 'gantt' && (
            <GanttChartView
              project={activeProject}
              bureaus={bureaus}
              initiatives={initiatives}
              stages={stages}
              tasks={tasks}
              selectedBureauId={selectedBureauId}
              selectedTeamId={selectedTeamId}
              selectedInitiativeId={selectedInitiativeId}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onSelectInitiative={(init) => setActiveDrawerInitiativeId(init.id)}
              onAddTaskToInitiative={(initiativeId) => openTaskCreateModal(initiativeId)}
              canEditInitiative={canEditInitiative}
            />
          )}

          {viewMode === 'calendar' && (
            <MasterCalendarView
              project={activeProject}
              bureaus={bureaus}
              initiatives={initiatives}
              stages={stages}
              tasks={tasks}
              selectedBureauId={selectedBureauId}
              selectedTeamId={selectedTeamId}
              selectedInitiativeId={selectedInitiativeId}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onSelectInitiative={(init) => setActiveDrawerInitiativeId(init.id)}
              onCreateDeadlineForDate={
                canCreateAnyTask
                  ? (dateStr) => openTaskCreateModal(null, null, null, dateStr)
                  : undefined
              }
            />
          )}

          {viewMode === 'list' && (
            <TaskListView
              bureaus={bureaus}
              initiatives={initiatives}
              stages={stages}
              tasks={tasks}
              selectedBureauId={selectedBureauId}
              selectedTeamId={selectedTeamId}
              selectedInitiativeId={selectedInitiativeId}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onSelectInitiative={(init) => setActiveDrawerInitiativeId(init.id)}
              onCreateTask={() => openTaskCreateModal()}
              canCreateAnyTask={canCreateAnyTask}
              canEditInitiative={canEditInitiative}
              onQuickUpdateProgress={handleQuickUpdateProgress}
              onToggleVerify={(t) => {
                if (!canEditInitiative(t.initiativeId)) return Promise.resolve();
                return toggleTaskVerification(
                  activeProject.id,
                  t.id,
                  !t.isVerified,
                  !t.isVerified ? userDisplayName : ''
                );
              }}
            />
          )}
        </main>
      </div>

      {/* Drawers & Modals */}
      {activeDrawerInitiative && (
        <InitiativeDetailDrawer
          uid={effectiveUid}
          projectId={activeProject.id}
          initiative={activeDrawerInitiative}
          role={getInitiativeRole(activeDrawerInitiative.id) || 'viewer'}
          bureaus={bureaus}
          stages={stages}
          tasks={tasks}
          userDisplayName={userDisplayName}
          onSelectTask={(t) => setSelectedTaskId(t.id)}
          onAddTaskForInitiative={(initiativeId, bureauId, teamId) =>
            openTaskCreateModal(initiativeId, bureauId || null, teamId || null)
          }
          onQuickUpdateTaskProgress={handleQuickUpdateProgress}
          onShareInitiative={
            isBoardOwner ? () => setShareInitiativeTarget(activeDrawerInitiative) : undefined
          }
          onLeaveInitiative={
            user && !isBoardOwner
              ? async () => {
                  await leaveSharedInitiative(user.uid, activeProject.id, activeDrawerInitiative.id);
                  setActiveDrawerInitiativeId(null);
                }
              : undefined
          }
          onClose={() => setActiveDrawerInitiativeId(null)}
        />
      )}

      {selectedTask && (
        <TaskDetailDrawer
          uid={effectiveUid}
          projectId={activeProject.id}
          task={selectedTask}
          bureaus={bureaus}
          initiatives={initiatives}
          stages={stages}
          userDisplayName={userDisplayName}
          canEdit={canEditInitiative(selectedTask.initiativeId)}
          isBoardOwner={isBoardOwner}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {taskCreateModalState.open && canCreateAnyTask && (
        <TaskCreateModal
          uid={effectiveUid}
          projectId={activeProject.id}
          bureaus={bureaus}
          initiatives={isBoardOwner || isPublicBoardEditor ? initiatives : editableInitiatives}
          stages={stages}
          isBoardOwner={isBoardOwner}
          allowUnassigned={isBoardOwner || isPublicBoardEditor}
          defaultBureauId={taskCreateModalState.bureauId}
          defaultTeamId={taskCreateModalState.teamId}
          defaultInitiativeId={taskCreateModalState.initiativeId}
          defaultDeadlineDate={taskCreateModalState.deadlineDate}
          onClose={() =>
            setTaskCreateModalState({
              open: false,
              initiativeId: null,
              bureauId: null,
              teamId: null,
              deadlineDate: null,
            })
          }
        />
      )}

      {user && isBoardOwner && initiativeModalState.open && (
        <InitiativeModal
          uid={user.uid}
          projectId={activeProject.id}
          bureaus={bureaus}
          stages={stages}
          initiative={initiativeModalState.target}
          onClose={() => setInitiativeModalState({ open: false, target: null })}
        />
      )}

      {user && isBoardOwner && shareInitiativeTarget && (
        <InitiativeShareModal
          uid={user.uid}
          ownerName={userDisplayName}
          project={activeProject}
          initiative={shareInitiativeTarget}
          onClose={() => setShareInitiativeTarget(null)}
        />
      )}

      {user && isBoardOwner && publicLinkModalOpen && (
        <PublicLinkShareModal
          uid={user.uid}
          ownerName={userDisplayName}
          project={activeProject}
          initiatives={initiatives}
          publicEntry={publicEntry}
          onClose={() => setPublicLinkModalOpen(false)}
        />
      )}

      {user && isBoardOwner && settingsModalState.open && (
        <OrgAndStagesModal
          uid={user.uid}
          project={activeProject}
          bureaus={bureaus}
          stages={stages}
          initialTab={settingsModalState.initialTab}
          onDeletedProject={() => {
            setActiveProjectId(null);
            resetBoardSelection();
          }}
          onClose={() => setSettingsModalState({ open: false, initialTab: 'bureaus' })}
        />
      )}

      {user && showNewProjectModal && (
        <ProjectSetupScreen
          uid={user.uid}
          isModal
          pendingInvitesCount={unjoinedEmailInvites.length}
          onOpenJoinModal={() => {
            setShowNewProjectModal(false);
            setJoinModalOpen(true);
          }}
          onCreated={(newId) => {
            setActiveProjectId(newId);
            setShowNewProjectModal(false);
            resetBoardSelection();
          }}
          onCancel={() => setShowNewProjectModal(false)}
        />
      )}

      {joinModalOpen && (
        <InviteJoinModal
          user={user}
          initialInviteCode={pendingUrlInviteCode}
          pendingEmailInvites={pendingEmailInvites}
          joinedInitiativeKeys={joinedInitiativeKeys}
          onJoined={handleJoinedInitiative}
          onGuestOpenInvite={(inv) => {
            setGuestInviteCode(inv.id);
            try {
              sessionStorage.setItem(INVITE_STORAGE_KEY, inv.id);
            } catch {
              // Ignore
            }
            resetBoardSelection();
            handleCloseJoinModal();
          }}
          onClose={handleCloseJoinModal}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceApp />
    </ErrorBoundary>
  );
}
