import { User } from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { buildSampleFestivalSeed } from '../data/sampleFestivalSeed';
import {
  AttachmentCategory,
  AttachmentKind,
  Bureau,
  ColorKey,
  FestivalTask,
  FIELD_LIMITS,
  Initiative,
  InitiativeMember,
  InviteAccessRole,
  InviteStatus,
  InviteType,
  JoinedInitiative,
  NoteType,
  ProgressStage,
  Project,
  ProjectInvite,
  PublicEntry,
  PublicEntryScope,
  PublicEntryStatus,
  PublicLinkRole,
  StageTone,
  TaskAttachment,
  TaskNote,
  TeamRef,
  WorkspaceSharedConfig,
} from '../types';

export const PUBLIC_APP_URL = 'https://oudaisai-project15.ai.studio';

export function getShareBaseUrl(): string {
  if (typeof window === 'undefined') return PUBLIC_APP_URL;
  const host = window.location.hostname;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('ais-dev-') ||
    host.startsWith('ais-pre-')
  ) {
    return PUBLIC_APP_URL;
  }
  return window.location.origin;
}

function sanitizeString(val: string, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

export function generateSafeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  const raw = `${prefix}_${ts}_${random}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export function generateInviteCode(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i += 1) {
      token += alphabet[bytes[i] % alphabet.length];
    }
  } else {
    for (let i = 0; i < 18; i += 1) {
      token += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return `inv_${token}`;
}

export function extractInviteCode(rawInput: string): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      const fromQuery = parsed.searchParams.get('invite') || '';
      return fromQuery.trim();
    }
  } catch {
    // Fall back to direct string parsing
  }
  const match = trimmed.match(/[?&]invite=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function subscribeToProjects(
  uid: string,
  onData: (projects: Project[]) => void
): () => void {
  const path = 'projects';
  const q = query(collection(db, path), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Project[] = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Project, 'id'>),
        }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToJoinedInitiatives(
  uid: string,
  onData: (joined: JoinedInitiative[]) => void
): () => void {
  const path = `users/${uid}/joinedInitiatives`;
  const q = query(collection(db, path), where('uid', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: JoinedInitiative[] = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<JoinedInitiative, 'id'>),
        }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToProjectData(
  uid: string,
  projectId: string,
  callbacks: {
    onBureaus: (bureaus: Bureau[]) => void;
    onInitiatives: (initiatives: Initiative[]) => void;
    onStages: (stages: ProgressStage[]) => void;
    onTasks: (tasks: FestivalTask[]) => void;
  }
): () => void {
  const bureausPath = `projects/${projectId}/bureaus`;
  const initiativesPath = `projects/${projectId}/initiatives`;
  const stagesPath = `projects/${projectId}/stages`;
  const tasksPath = `projects/${projectId}/tasks`;

  let ownerTasks: FestivalTask[] = [];
  const extraTasksMap = new Map<string, FestivalTask>();
  const extraTaskUnsubs = new Map<string, () => void>();
  let latestInitiativeTaskIds: string[] = [];

  const emitMergedTasks = () => {
    const merged = new Map<string, FestivalTask>();
    for (const t of ownerTasks) merged.set(t.id, t);
    for (const [id, t] of extraTasksMap.entries()) {
      if (!merged.has(id)) merged.set(id, t);
    }
    callbacks.onTasks(
      Array.from(merged.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
    );
  };

  const syncExtraTaskListeners = () => {
    const ownerIdSet = new Set(ownerTasks.map((t) => t.id));
    const needed = new Set(latestInitiativeTaskIds.filter((id) => id && !ownerIdSet.has(id)));

    for (const [id, unsub] of extraTaskUnsubs.entries()) {
      if (!needed.has(id)) {
        unsub();
        extraTaskUnsubs.delete(id);
        extraTasksMap.delete(id);
      }
    }

    for (const id of needed) {
      if (!extraTaskUnsubs.has(id)) {
        const taskDocPath = `projects/${projectId}/tasks/${id}`;
        const unsub = onSnapshot(
          doc(db, 'projects', projectId, 'tasks', id),
          (snap) => {
            if (snap.exists()) {
              extraTasksMap.set(id, {
                id: snap.id,
                ...(snap.data() as Omit<FestivalTask, 'id'>),
              });
            } else {
              extraTasksMap.delete(id);
            }
            emitMergedTasks();
          },
          (err) => {
            if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
              extraTasksMap.delete(id);
              emitMergedTasks();
              return;
            }
            handleFirestoreError(err, OperationType.GET, taskDocPath);
          }
        );
        extraTaskUnsubs.set(id, unsub);
      }
    }
    emitMergedTasks();
  };

  const unsubBureaus = onSnapshot(
    query(collection(db, bureausPath), where('ownerId', '==', uid)),
    (snap) => {
      callbacks.onBureaus(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Bureau, 'id'>) }))
          .sort((a, b) => a.order - b.order)
      );
    },
    (err) => handleFirestoreError(err, OperationType.LIST, bureausPath)
  );

  const unsubInitiatives = onSnapshot(
    query(collection(db, initiativesPath), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Initiative, 'id'>) }))
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
      latestInitiativeTaskIds = Array.from(
        new Set(list.flatMap((init) => init.taskIds || []))
      );
      callbacks.onInitiatives(list);
      syncExtraTaskListeners();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, initiativesPath)
  );

  const unsubStages = onSnapshot(
    query(collection(db, stagesPath), where('ownerId', '==', uid)),
    (snap) => {
      callbacks.onStages(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ProgressStage, 'id'>) }))
          .sort((a, b) => a.order - b.order)
      );
    },
    (err) => handleFirestoreError(err, OperationType.LIST, stagesPath)
  );

  const unsubTasks = onSnapshot(
    query(collection(db, tasksPath), where('ownerId', '==', uid)),
    (snap) => {
      ownerTasks = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FestivalTask, 'id'>),
      }));
      syncExtraTaskListeners();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, tasksPath)
  );

  return () => {
    unsubBureaus();
    unsubInitiatives();
    unsubStages();
    unsubTasks();
    for (const unsub of extraTaskUnsubs.values()) {
      unsub();
    }
    extraTaskUnsubs.clear();
  };
}

export function subscribeToSharedBoardWorkspace(
  uid: string,
  projectId: string,
  joinedForBoard: JoinedInitiative[],
  callbacks: {
    onSharedConfig: (data: {
      project: Project;
      bureaus: Bureau[];
      stages: ProgressStage[];
    }) => void;
    onInitiatives: (initiatives: Initiative[]) => void;
    onTasks: (tasks: FestivalTask[]) => void;
    onMemberRoles: (roles: Record<string, InviteAccessRole>) => void;
    onStaleJoined?: (joined: JoinedInitiative) => void;
  }
): () => void {
  const sharedConfigPath = `projects/${projectId}/sharedConfig/workspace`;
  const unsubConfig = onSnapshot(
    doc(db, 'projects', projectId, 'sharedConfig', 'workspace'),
    (snap) => {
      if (!snap.exists()) return;
      const cfg = snap.data() as WorkspaceSharedConfig;
      const projectObj: Project = {
        id: projectId,
        name: cfg.projectName,
        festivalDate: cfg.festivalDate,
        festivalEndDate: cfg.festivalEndDate,
        description: cfg.description,
        ownerId: cfg.ownerId,
        isShared: true,
        updatedAt: cfg.updatedAt,
      };
      const bureausList: Bureau[] = (cfg.bureaus || [])
        .map((b) => ({
          ...b,
          ownerId: cfg.ownerId,
        }))
        .sort((a, b) => a.order - b.order);
      const stagesList: ProgressStage[] = (cfg.stages || [])
        .map((s) => ({
          ...s,
          ownerId: cfg.ownerId,
        }))
        .sort((a, b) => a.order - b.order);

      callbacks.onSharedConfig({
        project: projectObj,
        bureaus: bureausList,
        stages: stagesList,
      });
    },
    (err) => {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
        return;
      }
      handleFirestoreError(err, OperationType.GET, sharedConfigPath);
    }
  );

  const initiativesMap = new Map<string, Initiative>();
  const rolesMap: Record<string, InviteAccessRole> = {};
  const tasksMap = new Map<string, FestivalTask>();
  const taskUnsubs = new Map<string, () => void>();
  const initUnsubs: (() => void)[] = [];

  const emitInitiativesAndSyncTasks = () => {
    const list = Array.from(initiativesMap.values()).sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    );
    callbacks.onInitiatives(list);

    const neededTaskIds = new Set(list.flatMap((i) => i.taskIds || []));
    for (const [tId, unsub] of taskUnsubs.entries()) {
      if (!neededTaskIds.has(tId)) {
        unsub();
        taskUnsubs.delete(tId);
        tasksMap.delete(tId);
      }
    }

    for (const tId of neededTaskIds) {
      if (!taskUnsubs.has(tId)) {
        const taskPath = `projects/${projectId}/tasks/${tId}`;
        const u = onSnapshot(
          doc(db, 'projects', projectId, 'tasks', tId),
          (tSnap) => {
            if (tSnap.exists()) {
              tasksMap.set(tId, {
                id: tSnap.id,
                ...(tSnap.data() as Omit<FestivalTask, 'id'>),
              });
            } else {
              tasksMap.delete(tId);
            }
            callbacks.onTasks(
              Array.from(tasksMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
            );
          },
          (err) => {
            if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
              tasksMap.delete(tId);
              callbacks.onTasks(
                Array.from(tasksMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
              );
              return;
            }
            handleFirestoreError(err, OperationType.GET, taskPath);
          }
        );
        taskUnsubs.set(tId, u);
      }
    }

    callbacks.onTasks(
      Array.from(tasksMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
    );
  };

  for (const joined of joinedForBoard) {
    const initId = joined.initiativeId;
    rolesMap[initId] = joined.role;

    const initPath = `projects/${projectId}/initiatives/${initId}`;
    const uInit = onSnapshot(
      doc(db, 'projects', projectId, 'initiatives', initId),
      (snap) => {
        if (snap.exists()) {
          initiativesMap.set(initId, {
            id: snap.id,
            ...(snap.data() as Omit<Initiative, 'id'>),
          });
        } else {
          initiativesMap.delete(initId);
          callbacks.onStaleJoined?.(joined);
        }
        emitInitiativesAndSyncTasks();
      },
      (err) => {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
          initiativesMap.delete(initId);
          emitInitiativesAndSyncTasks();
          callbacks.onStaleJoined?.(joined);
          return;
        }
        handleFirestoreError(err, OperationType.GET, initPath);
      }
    );
    initUnsubs.push(uInit);

    const memberPath = `projects/${projectId}/initiatives/${initId}/members/${uid}`;
    const uMember = onSnapshot(
      doc(db, 'projects', projectId, 'initiatives', initId, 'members', uid),
      (mSnap) => {
        if (mSnap.exists()) {
          const data = mSnap.data() as Omit<InitiativeMember, 'id'>;
          rolesMap[initId] = data.role;
          callbacks.onMemberRoles({ ...rolesMap });
        } else {
          callbacks.onStaleJoined?.(joined);
        }
      },
      (err) => {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
          callbacks.onStaleJoined?.(joined);
          return;
        }
        handleFirestoreError(err, OperationType.GET, memberPath);
      }
    );
    initUnsubs.push(uMember);
  }

  callbacks.onMemberRoles({ ...rolesMap });

  return () => {
    unsubConfig();
    for (const u of initUnsubs) u();
    for (const u of taskUnsubs.values()) u();
    taskUnsubs.clear();
  };
}

export function subscribeToPublicEntry(
  onUpdate: (entry: PublicEntry | null, loaded: boolean) => void
): () => void {
  const path = 'publicEntry/default';
  return onSnapshot(
    doc(db, 'publicEntry', 'default'),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null, true);
        return;
      }
      onUpdate(
        {
          id: snap.id,
          ...(snap.data() as Omit<PublicEntry, 'id'>),
        },
        true
      );
    },
    (err) => {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
        onUpdate(null, true);
        return;
      }
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export function subscribeToPublicBoardGuestWorkspace(
  entry: PublicEntry,
  callbacks: {
    onSharedConfig: (data: {
      project: Project;
      bureaus: Bureau[];
      stages: ProgressStage[];
    }) => void;
    onInitiatives: (initiatives: Initiative[]) => void;
    onTasks: (tasks: FestivalTask[]) => void;
    onUnavailable?: () => void;
  }
): () => void {
  const { projectId, accessScope, initiativeIds } = entry;
  const sharedConfigPath = `projects/${projectId}/sharedConfig/workspace`;
  const initiativesMap = new Map<string, Initiative>();
  const tasksMap = new Map<string, FestivalTask>();
  const taskUnsubs = new Map<string, () => void>();
  const initUnsubs: (() => void)[] = [];
  let unassignedTaskIds: string[] = [];

  const syncTaskListeners = () => {
    const initTaskIds = Array.from(initiativesMap.values()).flatMap((i) => i.taskIds || []);
    const extraBoardTasks = accessScope === 'board' ? unassignedTaskIds : [];
    const neededTaskIds = new Set([...initTaskIds, ...extraBoardTasks].filter(Boolean));

    for (const [tId, unsub] of taskUnsubs.entries()) {
      if (!neededTaskIds.has(tId)) {
        unsub();
        taskUnsubs.delete(tId);
        tasksMap.delete(tId);
      }
    }

    for (const tId of neededTaskIds) {
      if (!taskUnsubs.has(tId)) {
        const taskPath = `projects/${projectId}/tasks/${tId}`;
        const u = onSnapshot(
          doc(db, 'projects', projectId, 'tasks', tId),
          (tSnap) => {
            if (tSnap.exists()) {
              tasksMap.set(tId, {
                id: tSnap.id,
                ...(tSnap.data() as Omit<FestivalTask, 'id'>),
              });
            } else {
              tasksMap.delete(tId);
            }
            callbacks.onTasks(
              Array.from(tasksMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
            );
          },
          (err) => {
            if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
              tasksMap.delete(tId);
              callbacks.onTasks(
                Array.from(tasksMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
              );
              return;
            }
            handleFirestoreError(err, OperationType.GET, taskPath);
          }
        );
        taskUnsubs.set(tId, u);
      }
    }

    callbacks.onTasks(
      Array.from(tasksMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
    );
  };

  const emitInitiativesAndSyncTasks = () => {
    const list = Array.from(initiativesMap.values()).sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    );
    callbacks.onInitiatives(list);
    syncTaskListeners();
  };

  const unsubConfig = onSnapshot(
    doc(db, 'projects', projectId, 'sharedConfig', 'workspace'),
    (snap) => {
      if (!snap.exists()) {
        callbacks.onUnavailable?.();
        return;
      }
      const cfg = snap.data() as WorkspaceSharedConfig;
      unassignedTaskIds = cfg.unassignedTaskIds || [];
      const projectObj: Project = {
        id: projectId,
        name: cfg.projectName,
        festivalDate: cfg.festivalDate,
        festivalEndDate: cfg.festivalEndDate,
        description: cfg.description,
        ownerId: cfg.ownerId,
        isShared: true,
        updatedAt: cfg.updatedAt,
      };
      const bureausList: Bureau[] = (cfg.bureaus || [])
        .map((b) => ({
          ...b,
          ownerId: cfg.ownerId,
        }))
        .sort((a, b) => a.order - b.order);
      const stagesList: ProgressStage[] = (cfg.stages || [])
        .map((s) => ({
          ...s,
          ownerId: cfg.ownerId,
        }))
        .sort((a, b) => a.order - b.order);

      callbacks.onSharedConfig({
        project: projectObj,
        bureaus: bureausList,
        stages: stagesList,
      });
      syncTaskListeners();
    },
    (err) => {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
        callbacks.onUnavailable?.();
        return;
      }
      handleFirestoreError(err, OperationType.GET, sharedConfigPath);
    }
  );

  for (const initId of Array.from(new Set(initiativeIds || []))) {
    if (!initId) continue;
    const initPath = `projects/${projectId}/initiatives/${initId}`;
    const uInit = onSnapshot(
      doc(db, 'projects', projectId, 'initiatives', initId),
      (snap) => {
        if (snap.exists()) {
          initiativesMap.set(initId, {
            id: snap.id,
            ...(snap.data() as Omit<Initiative, 'id'>),
          });
        } else {
          initiativesMap.delete(initId);
        }
        emitInitiativesAndSyncTasks();
      },
      (err) => {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
          initiativesMap.delete(initId);
          emitInitiativesAndSyncTasks();
          return;
        }
        handleFirestoreError(err, OperationType.GET, initPath);
      }
    );
    initUnsubs.push(uInit);
  }

  if ((initiativeIds || []).length === 0) {
    callbacks.onInitiatives([]);
    syncTaskListeners();
  }

  return () => {
    unsubConfig();
    for (const u of initUnsubs) u();
    for (const u of taskUnsubs.values()) u();
    taskUnsubs.clear();
  };
}

export function subscribeToInviteGuestWorkspace(
  inviteId: string,
  callbacks: {
    onInvite: (invite: ProjectInvite) => void;
    onSharedConfig: (data: {
      project: Project;
      bureaus: Bureau[];
      stages: ProgressStage[];
    }) => void;
    onInitiatives: (initiatives: Initiative[]) => void;
    onTasks: (tasks: FestivalTask[]) => void;
    onUnavailable: (reason?: string) => void;
  }
): () => void {
  let innerUnsubs: (() => void)[] = [];
  let subscribedTargetKey = '';

  const cleanupInner = () => {
    for (const u of innerUnsubs) u();
    innerUnsubs = [];
  };

  const invitePath = `projectInvites/${inviteId}`;
  const unsubInvite = onSnapshot(
    doc(db, 'projectInvites', inviteId),
    (invSnap) => {
      if (!invSnap.exists()) {
        cleanupInner();
        callbacks.onUnavailable('この共有リンクは無効または削除されています。');
        return;
      }
      const inv: ProjectInvite = {
        id: invSnap.id,
        ...(invSnap.data() as Omit<ProjectInvite, 'id'>),
      };
      if (inv.status !== 'active' || inv.inviteType !== 'link') {
        cleanupInner();
        callbacks.onUnavailable('この共有リンクは現在停止されています。オーナーにお問い合わせください。');
        return;
      }

      callbacks.onInvite(inv);

      const targetKey = `${inv.projectId}__${inv.initiativeId}`;
      if (subscribedTargetKey === targetKey) return;
      subscribedTargetKey = targetKey;
      cleanupInner();

      const { projectId, initiativeId } = inv;
      const tasksMap = new Map<string, FestivalTask>();
      const taskUnsubs = new Map<string, () => void>();

      const unsubConfig = onSnapshot(
        doc(db, 'projects', projectId, 'sharedConfig', 'workspace'),
        (snap) => {
          if (!snap.exists()) {
            callbacks.onUnavailable('共有設定データが見つかりませんでした。');
            return;
          }
          const cfg = snap.data() as WorkspaceSharedConfig;
          const projectObj: Project = {
            id: projectId,
            name: cfg.projectName,
            festivalDate: cfg.festivalDate,
            festivalEndDate: cfg.festivalEndDate,
            description: cfg.description,
            ownerId: cfg.ownerId,
            isShared: true,
            updatedAt: cfg.updatedAt,
          };
          const bureausList: Bureau[] = (cfg.bureaus || [])
            .map((b) => ({ ...b, ownerId: cfg.ownerId }))
            .sort((a, b) => a.order - b.order);
          const stagesList: ProgressStage[] = (cfg.stages || [])
            .map((s) => ({ ...s, ownerId: cfg.ownerId }))
            .sort((a, b) => a.order - b.order);

          callbacks.onSharedConfig({
            project: projectObj,
            bureaus: bureausList,
            stages: stagesList,
          });
        },
        (err) => {
          if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
            callbacks.onUnavailable('この共有リンクの権限が無効になっています。');
            return;
          }
          handleFirestoreError(err, OperationType.GET, `projects/${projectId}/sharedConfig/workspace`);
        }
      );

      const unsubInit = onSnapshot(
        doc(db, 'projects', projectId, 'initiatives', initiativeId),
        (initSnap) => {
          if (!initSnap.exists()) {
            callbacks.onInitiatives([]);
            callbacks.onUnavailable('共有されたプロジェクトが見つかりませんでした。');
            return;
          }
          const initData: Initiative = {
            id: initSnap.id,
            ...(initSnap.data() as Omit<Initiative, 'id'>),
          };
          callbacks.onInitiatives([initData]);

          const neededTaskIds = new Set((initData.taskIds || []).filter(Boolean));
          for (const [tId, u] of taskUnsubs.entries()) {
            if (!neededTaskIds.has(tId)) {
              u();
              taskUnsubs.delete(tId);
              tasksMap.delete(tId);
            }
          }
          for (const tId of neededTaskIds) {
            if (!taskUnsubs.has(tId)) {
              const uTask = onSnapshot(
                doc(db, 'projects', projectId, 'tasks', tId),
                (tSnap) => {
                  if (tSnap.exists()) {
                    tasksMap.set(tId, {
                      id: tSnap.id,
                      ...(tSnap.data() as Omit<FestivalTask, 'id'>),
                    });
                  } else {
                    tasksMap.delete(tId);
                  }
                  callbacks.onTasks(
                    Array.from(tasksMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
                  );
                },
                (err) => {
                  if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
                    tasksMap.delete(tId);
                    callbacks.onTasks(
                      Array.from(tasksMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
                    );
                    return;
                  }
                  handleFirestoreError(err, OperationType.GET, `projects/${projectId}/tasks/${tId}`);
                }
              );
              taskUnsubs.set(tId, uTask);
            }
          }
          callbacks.onTasks(
            Array.from(tasksMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
          );
        },
        (err) => {
          if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
            callbacks.onUnavailable('この共有リンクの権限が無効になっています。');
            return;
          }
          handleFirestoreError(
            err,
            OperationType.GET,
            `projects/${projectId}/initiatives/${initiativeId}`
          );
        }
      );

      innerUnsubs.push(unsubConfig, unsubInit, () => {
        for (const u of taskUnsubs.values()) u();
        taskUnsubs.clear();
      });
    },
    (err) => {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
        cleanupInner();
        callbacks.onUnavailable('この共有リンクは期限切れか停止されています。');
        return;
      }
      handleFirestoreError(err, OperationType.GET, invitePath);
    }
  );

  return () => {
    unsubInvite();
    cleanupInner();
  };
}

function subscribeToMergedDocsByOwnerAndIds<T extends { id: string; createdAt?: { toMillis?: () => number } }>(
  uid: string,
  collectionPath: string,
  knownIds: string[],
  onData: (items: T[]) => void
): () => void {
  let ownDocs: T[] = [];
  const docMap = new Map<string, T>();
  const docUnsubs = new Map<string, () => void>();
  const isGuest = !uid || uid === 'guest_link';

  const emit = () => {
    const merged = new Map<string, T>();
    for (const item of ownDocs) merged.set(item.id, item);
    for (const [id, item] of docMap.entries()) {
      if (!merged.has(id)) merged.set(id, item);
    }
    const sorted = Array.from(merged.values()).sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? Date.now();
      const tb = b.createdAt?.toMillis?.() ?? Date.now();
      return tb - ta;
    });
    onData(sorted);
  };

  const unsubQuery = isGuest
    ? () => {}
    : onSnapshot(
        query(collection(db, collectionPath), where('ownerId', '==', uid)),
        (snap) => {
          ownDocs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<T, 'id'>),
          })) as T[];
          emit();
        },
        (err) => {
          if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
            return;
          }
          handleFirestoreError(err, OperationType.LIST, collectionPath);
        }
      );

  for (const id of knownIds) {
    if (!id || docUnsubs.has(id)) continue;
    const docPath = `${collectionPath}/${id}`;
    const u = onSnapshot(
      doc(db, collectionPath, id),
      (snap) => {
        if (snap.exists()) {
          docMap.set(id, { id: snap.id, ...(snap.data() as Omit<T, 'id'>) } as T);
        } else {
          docMap.delete(id);
        }
        emit();
      },
      (err) => {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'permission-denied') {
          docMap.delete(id);
          emit();
          return;
        }
        handleFirestoreError(err, OperationType.GET, docPath);
      }
    );
    docUnsubs.set(id, u);
  }

  return () => {
    unsubQuery();
    for (const u of docUnsubs.values()) u();
    docUnsubs.clear();
  };
}

export function subscribeToInitiativeNotes(
  uid: string,
  projectId: string,
  initiativeId: string,
  knownNoteIds: string[],
  onNotes: (notes: TaskNote[]) => void
): () => void {
  return subscribeToMergedDocsByOwnerAndIds<TaskNote>(
    uid,
    `projects/${projectId}/initiatives/${initiativeId}/notes`,
    knownNoteIds,
    onNotes
  );
}

export function subscribeToTaskNotes(
  uid: string,
  projectId: string,
  taskId: string,
  knownNoteIds: string[],
  onNotes: (notes: TaskNote[]) => void
): () => void {
  return subscribeToMergedDocsByOwnerAndIds<TaskNote>(
    uid,
    `projects/${projectId}/tasks/${taskId}/notes`,
    knownNoteIds,
    onNotes
  );
}

export function subscribeToTaskAttachments(
  uid: string,
  projectId: string,
  taskId: string,
  knownAttachmentIds: string[],
  onAttachments: (attachments: TaskAttachment[]) => void
): () => void {
  return subscribeToMergedDocsByOwnerAndIds<TaskAttachment>(
    uid,
    `projects/${projectId}/tasks/${taskId}/attachments`,
    knownAttachmentIds,
    onAttachments
  );
}

export async function syncWorkspaceSharedConfig(uid: string, projectId: string): Promise<void> {
  const path = `projects/${projectId}/sharedConfig/workspace`;
  try {
    const projectSnap = await getDoc(doc(db, 'projects', projectId));
    if (!projectSnap.exists()) return;
    const pData = projectSnap.data() as Omit<Project, 'id'>;
    if (pData.ownerId !== uid) return;

    const [bureausSnap, stagesSnap, tasksSnap, invitesSnap] = await Promise.all([
      getDocs(query(collection(db, `projects/${projectId}/bureaus`), where('ownerId', '==', uid))),
      getDocs(query(collection(db, `projects/${projectId}/stages`), where('ownerId', '==', uid))),
      getDocs(query(collection(db, `projects/${projectId}/tasks`), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'projectInvites'), where('ownerId', '==', uid))),
    ]);

    const cleanBureaus = bureausSnap.docs
      .map((d) => {
        const b = d.data() as Omit<Bureau, 'id'>;
        return {
          id: d.id,
          name: sanitizeString(b.name, FIELD_LIMITS.BUREAU_NAME_MAX) || '局',
          shortName: sanitizeString(b.shortName, FIELD_LIMITS.BUREAU_SHORT_MAX) || '局',
          colorKey: b.colorKey,
          order: b.order,
          teams: (b.teams || [])
            .slice(0, FIELD_LIMITS.MAX_TEAMS_PER_BUREAU)
            .map((tm) => ({
              id: tm.id,
              name: sanitizeString(tm.name, FIELD_LIMITS.TEAM_NAME_MAX) || '担当',
            })),
        };
      })
      .sort((a, b) => a.order - b.order)
      .slice(0, FIELD_LIMITS.MAX_SHARED_BUREAUS);

    const cleanStages = stagesSnap.docs
      .map((d) => {
        const s = d.data() as Omit<ProgressStage, 'id'>;
        return {
          id: d.id,
          name: sanitizeString(s.name, FIELD_LIMITS.STAGE_NAME_MAX) || '段階',
          order: s.order,
          defaultPercent: s.defaultPercent,
          tone: s.tone,
        };
      })
      .sort((a, b) => a.order - b.order)
      .slice(0, FIELD_LIMITS.MAX_SHARED_STAGES);

    const unassignedTaskIds = tasksSnap.docs
      .filter((d) => {
        const t = d.data() as FestivalTask;
        return !t.initiativeId;
      })
      .map((d) => d.id)
      .slice(0, 100);

    const hasActiveLinkShare = invitesSnap.docs.some((d) => {
      const inv = d.data() as ProjectInvite;
      return inv.projectId === projectId && inv.inviteType === 'link' && inv.status === 'active';
    });

    await setDoc(doc(db, 'projects', projectId, 'sharedConfig', 'workspace'), {
      projectName: sanitizeString(pData.name, FIELD_LIMITS.PROJECT_NAME_MAX) || '大学祭ボード',
      festivalDate: pData.festivalDate,
      festivalEndDate: pData.festivalEndDate,
      description: sanitizeString(pData.description, FIELD_LIMITS.PROJECT_DESC_MAX),
      bureaus: cleanBureaus,
      stages: cleanStages,
      hasActiveLinkShare,
      unassignedTaskIds,
      ownerId: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncInitiativePublicLinkRole(
  uid: string,
  projectId: string,
  initiativeId: string
): Promise<void> {
  try {
    const invitesSnap = await getDocs(
      query(collection(db, 'projectInvites'), where('ownerId', '==', uid))
    );
    const activeProjectLinks = invitesSnap.docs
      .map((d) => d.data() as ProjectInvite)
      .filter(
        (inv) =>
          inv.projectId === projectId &&
          inv.inviteType === 'link' &&
          inv.status === 'active'
      );

    const activeInitLinks = activeProjectLinks.filter((i) => i.initiativeId === initiativeId);
    let nextRole: PublicLinkRole = 'none';
    if (activeInitLinks.some((i) => i.role === 'editor')) {
      nextRole = 'editor';
    } else if (activeInitLinks.some((i) => i.role === 'viewer')) {
      nextRole = 'viewer';
    }

    const initRef = doc(db, 'projects', projectId, 'initiatives', initiativeId);
    const initSnap = await getDoc(initRef);
    if (initSnap.exists() && (initSnap.data() as Initiative).ownerId === uid) {
      await updateDoc(initRef, {
        publicLinkRole: nextRole,
        updatedAt: serverTimestamp(),
      });
    }

    const cfgRef = doc(db, 'projects', projectId, 'sharedConfig', 'workspace');
    const cfgSnap = await getDoc(cfgRef);
    if (cfgSnap.exists()) {
      await updateDoc(cfgRef, {
        hasActiveLinkShare: activeProjectLinks.length > 0,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.warn('syncInitiativePublicLinkRole skipped:', error);
  }
}

export async function syncBoardPublicShareMetadata(
  uid: string,
  projectId: string
): Promise<void> {
  try {
    await syncWorkspaceSharedConfig(uid, projectId);
    const [invitesSnap, initsSnap] = await Promise.all([
      getDocs(query(collection(db, 'projectInvites'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, `projects/${projectId}/initiatives`), where('ownerId', '==', uid))),
    ]);

    const activeLinksByInit = new Map<string, PublicLinkRole>();
    for (const d of invitesSnap.docs) {
      const inv = d.data() as ProjectInvite;
      if (inv.projectId === projectId && inv.inviteType === 'link' && inv.status === 'active') {
        const prev = activeLinksByInit.get(inv.initiativeId) || 'none';
        if (inv.role === 'editor' || prev !== 'editor') {
          activeLinksByInit.set(inv.initiativeId, inv.role);
        }
      }
    }

    const batch = writeBatch(db);
    let hasInitUpdates = false;
    for (const iDoc of initsSnap.docs) {
      const iData = iDoc.data() as Initiative;
      const desired = activeLinksByInit.get(iDoc.id) || 'none';
      if ((iData.publicLinkRole || 'none') !== desired) {
        hasInitUpdates = true;
        batch.update(iDoc.ref, {
          publicLinkRole: desired,
          updatedAt: serverTimestamp(),
        });
      }
    }
    if (hasInitUpdates) {
      await batch.commit();
    }
  } catch (error) {
    console.warn('syncBoardPublicShareMetadata skipped:', error);
  }
}

export async function upsertPublicEntry(
  uid: string,
  ownerName: string,
  project: Project,
  input: {
    status: PublicEntryStatus;
    accessScope: PublicEntryScope;
    role: InviteAccessRole;
    initiativeIds: string[];
  }
): Promise<void> {
  const path = 'publicEntry/default';
  try {
    await syncWorkspaceSharedConfig(uid, project.id);
    const cleanInitIds = Array.from(new Set(input.initiativeIds.filter(Boolean))).slice(
      0,
      FIELD_LIMITS.MAX_PUBLIC_INITIATIVE_IDS
    );
    const entryRef = doc(db, 'publicEntry', 'default');
    const existingSnap = await getDoc(entryRef);
    const payload = {
      projectId: project.id,
      projectName: sanitizeString(project.name, FIELD_LIMITS.PROJECT_NAME_MAX) || '実行委員会ボード',
      status: input.status,
      accessScope: input.accessScope,
      role: input.role,
      initiativeIds: cleanInitIds,
      ownerName: sanitizeString(ownerName, FIELD_LIMITS.AUTHOR_NAME_MAX) || 'オーナー',
      updatedAt: serverTimestamp(),
    };
    if (existingSnap.exists()) {
      await updateDoc(entryRef, payload);
    } else {
      await setDoc(entryRef, {
        ...payload,
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensureDefaultPublicEntry(
  uid: string,
  ownerName: string,
  project: Project,
  initiatives: Initiative[]
): Promise<void> {
  try {
    if (project.ownerId !== uid) return;
    const entryRef = doc(db, 'publicEntry', 'default');
    const snap = await getDoc(entryRef);
    if (!snap.exists()) {
      await upsertPublicEntry(uid, ownerName, project, {
        status: 'active',
        accessScope: 'board',
        role: 'editor',
        initiativeIds: initiatives.map((i) => i.id),
      });
      return;
    }
    const data = snap.data() as Omit<PublicEntry, 'id'>;
    if (data.ownerId === uid && data.projectId === project.id && data.accessScope === 'board') {
      const nextIds = initiatives
        .map((i) => i.id)
        .slice(0, FIELD_LIMITS.MAX_PUBLIC_INITIATIVE_IDS);
      const prevSet = new Set(data.initiativeIds || []);
      const changed =
        nextIds.length !== (data.initiativeIds || []).length ||
        nextIds.some((id) => !prevSet.has(id)) ||
        data.projectName !== project.name;
      if (changed) {
        await updateDoc(entryRef, {
          projectName: sanitizeString(project.name, FIELD_LIMITS.PROJECT_NAME_MAX) || '実行委員会ボード',
          initiativeIds: nextIds,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    console.warn('ensureDefaultPublicEntry skipped:', error);
  }
}

export async function prepareInitiativeForSharing(
  uid: string,
  projectId: string,
  initiativeId: string
): Promise<void> {
  await syncWorkspaceSharedConfig(uid, projectId);
  const initPath = `projects/${projectId}/initiatives/${initiativeId}`;
  try {
    const initRef = doc(db, 'projects', projectId, 'initiatives', initiativeId);
    const initSnap = await getDoc(initRef);
    if (!initSnap.exists()) return;
    const initData = initSnap.data() as Omit<Initiative, 'id'>;
    if (initData.ownerId !== uid) return;

    const [tasksSnap, initNotesSnap] = await Promise.all([
      getDocs(query(collection(db, `projects/${projectId}/tasks`), where('ownerId', '==', uid))),
      getDocs(
        query(
          collection(db, `projects/${projectId}/initiatives/${initiativeId}/notes`),
          where('ownerId', '==', uid)
        )
      ),
    ]);

    const matchingTasks = tasksSnap.docs.filter(
      (d) => (d.data() as FestivalTask).initiativeId === initiativeId
    );
    const mergedTaskIds = Array.from(
      new Set([...(initData.taskIds || []), ...matchingTasks.map((d) => d.id)])
    ).slice(0, FIELD_LIMITS.MAX_TASK_IDS);

    const mergedInitNoteIds = Array.from(
      new Set([...(initData.noteIds || []), ...initNotesSnap.docs.map((d) => d.id)])
    ).slice(0, FIELD_LIMITS.MAX_NOTE_IDS);

    const batch = writeBatch(db);
    batch.update(initRef, {
      taskIds: mergedTaskIds,
      noteIds: mergedInitNoteIds,
      updatedAt: serverTimestamp(),
    });

    for (const tId of mergedTaskIds) {
      const taskRef = doc(db, 'projects', projectId, 'tasks', tId);
      const tSnap = await getDoc(taskRef);
      if (!tSnap.exists()) continue;
      const tData = tSnap.data() as Omit<FestivalTask, 'id'>;

      const [tNotesSnap, tAttsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, `projects/${projectId}/tasks/${tId}/notes`),
            where('ownerId', '==', uid)
          )
        ),
        getDocs(
          query(
            collection(db, `projects/${projectId}/tasks/${tId}/attachments`),
            where('ownerId', '==', uid)
          )
        ),
      ]);

      const mergedNoteIds = Array.from(
        new Set([...(tData.noteIds || []), ...tNotesSnap.docs.map((d) => d.id)])
      ).slice(0, FIELD_LIMITS.MAX_NOTE_IDS);
      const mergedAttIds = Array.from(
        new Set([...(tData.attachmentIds || []), ...tAttsSnap.docs.map((d) => d.id)])
      ).slice(0, FIELD_LIMITS.MAX_ATTACHMENT_IDS);

      if (
        mergedNoteIds.length !== (tData.noteIds || []).length ||
        mergedAttIds.length !== (tData.attachmentIds || []).length
      ) {
        batch.update(taskRef, {
          noteIds: mergedNoteIds,
          attachmentIds: mergedAttIds,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, initPath);
  }
}

export async function createInitiativeInvite(
  uid: string,
  ownerName: string,
  project: Project,
  initiative: Initiative,
  input: {
    inviteType: InviteType;
    invitedEmail?: string;
    role: InviteAccessRole;
  }
): Promise<string> {
  const inviteId = generateInviteCode();
  const path = `projectInvites/${inviteId}`;
  const cleanEmail =
    input.inviteType === 'email'
      ? sanitizeString(input.invitedEmail || '', FIELD_LIMITS.INVITE_EMAIL_MAX).toLowerCase()
      : '';

  if (input.inviteType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('有効なメールアドレスを入力してください。');
  }

  await prepareInitiativeForSharing(uid, project.id, initiative.id);

  try {
    await setDoc(doc(db, 'projectInvites', inviteId), {
      projectId: project.id,
      projectName: sanitizeString(project.name, FIELD_LIMITS.PROJECT_NAME_MAX) || '実行委員会ボード',
      initiativeId: initiative.id,
      initiativeName:
        sanitizeString(initiative.name, FIELD_LIMITS.INITIATIVE_NAME_MAX) || 'プロジェクト',
      inviteType: input.inviteType,
      invitedEmail: cleanEmail,
      role: input.role,
      status: 'active' as InviteStatus,
      ownerName: sanitizeString(ownerName, FIELD_LIMITS.AUTHOR_NAME_MAX) || 'オーナー',
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (input.inviteType === 'link') {
      await syncInitiativePublicLinkRole(uid, project.id, initiative.id);
    }
    return inviteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToInitiativeInvites(
  uid: string,
  projectId: string,
  initiativeId: string,
  onInvites: (invites: ProjectInvite[]) => void
): () => void {
  const path = 'projectInvites';
  const q = query(collection(db, path), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ProjectInvite, 'id'>) }))
        .filter((inv) => inv.projectId === projectId && inv.initiativeId === initiativeId)
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? Date.now();
          const tb = b.createdAt?.toMillis?.() ?? Date.now();
          return tb - ta;
        });
      onInvites(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeToPendingEmailInvites(
  email: string,
  onInvites: (invites: ProjectInvite[]) => void
): () => void {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) {
    onInvites([]);
    return () => {};
  }
  const path = 'projectInvites';
  const q = query(
    collection(db, path),
    where('inviteType', '==', 'email'),
    where('status', '==', 'active'),
    where('invitedEmail', '==', normalized)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ProjectInvite, 'id'>) }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? Date.now();
          const tb = b.createdAt?.toMillis?.() ?? Date.now();
          return tb - ta;
        });
      onInvites(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function updateProjectInvite(
  inviteId: string,
  patch: { role?: InviteAccessRole; status?: InviteStatus }
): Promise<void> {
  const path = `projectInvites/${inviteId}`;
  try {
    const ref = doc(db, 'projectInvites', inviteId);
    const snap = await getDoc(ref);
    await updateDoc(ref, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    if (snap.exists()) {
      const inv = snap.data() as ProjectInvite;
      if (inv.inviteType === 'link') {
        await syncInitiativePublicLinkRole(inv.ownerId, inv.projectId, inv.initiativeId);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProjectInvite(inviteId: string): Promise<void> {
  const path = `projectInvites/${inviteId}`;
  try {
    const ref = doc(db, 'projectInvites', inviteId);
    const snap = await getDoc(ref);
    await deleteDoc(ref);
    if (snap.exists()) {
      const inv = snap.data() as ProjectInvite;
      if (inv.inviteType === 'link') {
        await syncInitiativePublicLinkRole(inv.ownerId, inv.projectId, inv.initiativeId);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToInitiativeMembers(
  uid: string,
  projectId: string,
  initiativeId: string,
  onMembers: (members: InitiativeMember[]) => void
): () => void {
  const path = `projects/${projectId}/initiatives/${initiativeId}/members`;
  const q = query(collection(db, path), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<InitiativeMember, 'id'>) }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? Date.now();
          const tb = b.createdAt?.toMillis?.() ?? Date.now();
          return ta - tb;
        });
      onMembers(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function updateInitiativeMemberRole(
  projectId: string,
  initiativeId: string,
  memberUid: string,
  role: InviteAccessRole
): Promise<void> {
  const path = `projects/${projectId}/initiatives/${initiativeId}/members/${memberUid}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'initiatives', initiativeId, 'members', memberUid), {
      role,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeInitiativeMember(
  projectId: string,
  initiativeId: string,
  memberUid: string
): Promise<void> {
  const path = `projects/${projectId}/initiatives/${initiativeId}/members/${memberUid}`;
  try {
    await deleteDoc(
      doc(db, 'projects', projectId, 'initiatives', initiativeId, 'members', memberUid)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getInviteByCode(rawCodeOrUrl: string): Promise<ProjectInvite | null> {
  const code = extractInviteCode(rawCodeOrUrl);
  if (!code || !FIELD_LIMITS.ID_REGEX.test(code)) {
    return null;
  }
  const path = `projectInvites/${code}`;
  try {
    const snap = await getDoc(doc(db, 'projectInvites', code));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...(snap.data() as Omit<ProjectInvite, 'id'>),
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function acceptProjectInvite(
  user: User,
  invite: ProjectInvite
): Promise<{ projectId: string; initiativeId: string }> {
  if (invite.ownerId === user.uid) {
    throw new Error('あなたはこのプロジェクトの作成者（オーナー）です。');
  }
  if (invite.status !== 'active') {
    throw new Error('この招待は無効または取り消されています。');
  }

  const { projectId, initiativeId } = invite;
  const joinId = `${projectId}__${initiativeId}`;
  const collabRef = doc(db, 'projects', projectId, 'collaborators', user.uid);
  const memberRef = doc(
    db,
    'projects',
    projectId,
    'initiatives',
    initiativeId,
    'members',
    user.uid
  );
  const joinedRef = doc(db, 'users', user.uid, 'joinedInitiatives', joinId);
  const path = `projects/${projectId}/initiatives/${initiativeId}/members/${user.uid}`;

  try {
    const [collabSnap, memberSnap, joinedSnap] = await Promise.all([
      getDoc(collabRef),
      getDoc(memberRef),
      getDoc(joinedRef),
    ]);

    const batch = writeBatch(db);
    let hasWrites = false;

    if (!collabSnap.exists()) {
      hasWrites = true;
      batch.set(collabRef, {
        uid: user.uid,
        projectId,
        initiativeId,
        inviteId: invite.id,
        ownerId: invite.ownerId,
        createdAt: serverTimestamp(),
      });
    }

    if (!memberSnap.exists()) {
      hasWrites = true;
      batch.set(memberRef, {
        uid: user.uid,
        displayName:
          sanitizeString(user.displayName || user.email || '実行委員', FIELD_LIMITS.AUTHOR_NAME_MAX) ||
          '実行委員',
        role: invite.role,
        inviteId: invite.id,
        projectId,
        initiativeId,
        ownerId: invite.ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (!joinedSnap.exists()) {
      hasWrites = true;
      batch.set(joinedRef, {
        uid: user.uid,
        projectId,
        projectName: sanitizeString(invite.projectName, FIELD_LIMITS.PROJECT_NAME_MAX) || '共有ボード',
        initiativeId,
        initiativeName:
          sanitizeString(invite.initiativeName, FIELD_LIMITS.INITIATIVE_NAME_MAX) || '共有プロジェクト',
        role: invite.role,
        ownerId: invite.ownerId,
        createdAt: serverTimestamp(),
      });
    }

    if (hasWrites) {
      await batch.commit();
    }

    return { projectId, initiativeId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function leaveSharedInitiative(
  uid: string,
  projectId: string,
  initiativeId: string
): Promise<void> {
  const joinId = `${projectId}__${initiativeId}`;
  const path = `users/${uid}/joinedInitiatives/${joinId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(
      doc(db, 'projects', projectId, 'initiatives', initiativeId, 'members', uid)
    );
    batch.delete(doc(db, 'users', uid, 'joinedInitiatives', joinId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function removeStaleJoinedBookmark(
  uid: string,
  joinedId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, 'joinedInitiatives', joinedId));
  } catch {
    // Ignore stale bookmark cleanup errors
  }
}

export async function createProjectWithSeed(uid: string): Promise<string> {
  const seed = buildSampleFestivalSeed();
  const projectId = generateSafeId('proj');
  const projectPath = `projects/${projectId}`;

  try {
    await setDoc(doc(db, 'projects', projectId), {
      name: sanitizeString(seed.project.name, FIELD_LIMITS.PROJECT_NAME_MAX),
      festivalDate: seed.project.festivalDate,
      festivalEndDate: seed.project.festivalEndDate,
      description: sanitizeString(seed.project.description, FIELD_LIMITS.PROJECT_DESC_MAX),
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const batch = writeBatch(db);

    for (const b of seed.bureaus) {
      batch.set(doc(db, 'projects', projectId, 'bureaus', b.id), {
        name: sanitizeString(b.name, FIELD_LIMITS.BUREAU_NAME_MAX),
        shortName: sanitizeString(b.shortName, FIELD_LIMITS.BUREAU_SHORT_MAX),
        colorKey: b.colorKey,
        order: b.order,
        teams: b.teams.slice(0, FIELD_LIMITS.MAX_TEAMS_PER_BUREAU),
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const s of seed.stages) {
      batch.set(doc(db, 'projects', projectId, 'stages', s.id), {
        name: sanitizeString(s.name, FIELD_LIMITS.STAGE_NAME_MAX),
        order: s.order,
        defaultPercent: s.defaultPercent,
        tone: s.tone,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const init of seed.initiatives) {
      const initTaskIds = seed.tasks
        .filter((t) => t.initiativeId === init.id)
        .map((t) => t.id)
        .slice(0, FIELD_LIMITS.MAX_TASK_IDS);
      const initNoteIds = init.notes.map((n) => n.id).slice(0, FIELD_LIMITS.MAX_NOTE_IDS);
      batch.set(doc(db, 'projects', projectId, 'initiatives', init.id), {
        name: sanitizeString(init.name, FIELD_LIMITS.INITIATIVE_NAME_MAX),
        description: sanitizeString(init.description, FIELD_LIMITS.INITIATIVE_DESC_MAX),
        colorKey: init.colorKey,
        teamRefs: init.teamRefs.slice(0, FIELD_LIMITS.MAX_TEAM_REFS_PER_INITIATIVE),
        startDate: init.startDate,
        endDate: init.endDate >= init.startDate ? init.endDate : init.startDate,
        stageId: init.stageId,
        progressPercent: init.progressPercent,
        isMilestone: init.isMilestone,
        isVerified: init.isVerified,
        verifiedBy: sanitizeString(init.verifiedBy, FIELD_LIMITS.VERIFIED_BY_MAX),
        taskIds: initTaskIds,
        noteIds: initNoteIds,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const t of seed.tasks) {
      batch.set(doc(db, 'projects', projectId, 'tasks', t.id), {
        title: sanitizeString(t.title, FIELD_LIMITS.TASK_TITLE_MAX),
        description: sanitizeString(t.description, FIELD_LIMITS.TASK_DESC_MAX),
        bureauId: t.bureauId,
        teamId: t.teamId,
        assigneeName: sanitizeString(t.assigneeName, FIELD_LIMITS.ASSIGNEE_MAX),
        initiativeId: t.initiativeId,
        stageId: t.stageId,
        progressPercent: t.progressPercent,
        startDate: t.startDate,
        endDate: t.endDate >= t.startDate ? t.endDate : t.startDate,
        isMilestone: t.isMilestone,
        isVerified: t.isVerified,
        verifiedBy: sanitizeString(t.verifiedBy, FIELD_LIMITS.VERIFIED_BY_MAX),
        status: 'active',
        noteIds: t.notes.map((n) => n.id).slice(0, FIELD_LIMITS.MAX_NOTE_IDS),
        attachmentIds: t.attachments.map((a) => a.id).slice(0, FIELD_LIMITS.MAX_ATTACHMENT_IDS),
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    const subBatch = writeBatch(db);
    let hasSubDocs = false;

    for (const init of seed.initiatives) {
      for (const n of init.notes) {
        hasSubDocs = true;
        subBatch.set(doc(db, 'projects', projectId, 'initiatives', init.id, 'notes', n.id), {
          noteType: n.noteType,
          content: sanitizeString(n.content, FIELD_LIMITS.NOTE_CONTENT_MAX),
          authorName: sanitizeString(n.authorName, FIELD_LIMITS.AUTHOR_NAME_MAX),
          authorBureau: sanitizeString(n.authorBureau, FIELD_LIMITS.AUTHOR_BUREAU_MAX),
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
      }
    }

    for (const t of seed.tasks) {
      for (const n of t.notes) {
        hasSubDocs = true;
        subBatch.set(doc(db, 'projects', projectId, 'tasks', t.id, 'notes', n.id), {
          noteType: n.noteType,
          content: sanitizeString(n.content, FIELD_LIMITS.NOTE_CONTENT_MAX),
          authorName: sanitizeString(n.authorName, FIELD_LIMITS.AUTHOR_NAME_MAX),
          authorBureau: sanitizeString(n.authorBureau, FIELD_LIMITS.AUTHOR_BUREAU_MAX),
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
      }
      for (const att of t.attachments) {
        hasSubDocs = true;
        subBatch.set(doc(db, 'projects', projectId, 'tasks', t.id, 'attachments', att.id), {
          title: sanitizeString(att.title, FIELD_LIMITS.ATTACHMENT_TITLE_MAX),
          kind: 'link',
          category: att.category,
          url: sanitizeString(att.url, FIELD_LIMITS.ATTACHMENT_URL_MAX),
          fileName: '',
          mimeType: '',
          fileSize: 0,
          dataUrl: '',
          uploadedBy: sanitizeString(att.uploadedBy, FIELD_LIMITS.AUTHOR_NAME_MAX),
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
      }
    }

    if (hasSubDocs) {
      await subBatch.commit();
    }

    await syncWorkspaceSharedConfig(uid, projectId);
    return projectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, projectPath);
  }
}

export async function createEmptyProject(
  uid: string,
  input: {
    name: string;
    festivalDate: string;
    festivalEndDate: string;
    description: string;
  }
): Promise<string> {
  const projectId = generateSafeId('proj');
  const projectPath = `projects/${projectId}`;
  const start = input.festivalDate;
  const end = input.festivalEndDate >= start ? input.festivalEndDate : start;

  try {
    await setDoc(doc(db, 'projects', projectId), {
      name: sanitizeString(input.name, FIELD_LIMITS.PROJECT_NAME_MAX) || '新規大学祭ボード',
      festivalDate: start,
      festivalEndDate: end,
      description: sanitizeString(input.description, FIELD_LIMITS.PROJECT_DESC_MAX),
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const batch = writeBatch(db);
    const defaultStages: {
      id: string;
      name: string;
      order: number;
      defaultPercent: number;
      tone: StageTone;
    }[] = [
      { id: 'stage_1', name: '未着手', order: 1, defaultPercent: 0, tone: 'neutral' },
      { id: 'stage_2', name: '企画・下準備', order: 2, defaultPercent: 25, tone: 'info' },
      { id: 'stage_3', name: '作業中', order: 3, defaultPercent: 50, tone: 'progress' },
      { id: 'stage_4', name: '局内確認中', order: 4, defaultPercent: 75, tone: 'review' },
      { id: 'stage_5', name: '完了', order: 5, defaultPercent: 100, tone: 'done' },
    ];
    for (const s of defaultStages) {
      batch.set(doc(db, 'projects', projectId, 'stages', s.id), {
        ...s,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'projects', projectId, 'bureaus', 'bureau_general'), {
      name: '総務局',
      shortName: '総務',
      colorKey: 'indigo' as ColorKey,
      order: 1,
      teams: [{ id: 'team_general_core', name: '全体統括担当' }],
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    await syncWorkspaceSharedConfig(uid, projectId);
    return projectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, projectPath);
  }
}

export async function ensureDefaultStages(uid: string, projectId: string): Promise<void> {
  const stagesPath = `projects/${projectId}/stages`;
  try {
    const existingSnap = await getDocs(
      query(collection(db, stagesPath), where('ownerId', '==', uid))
    );
    if (!existingSnap.empty) return;

    const batch = writeBatch(db);
    const defaultStages: {
      id: string;
      name: string;
      order: number;
      defaultPercent: number;
      tone: StageTone;
    }[] = [
      { id: 'stage_1', name: '未着手', order: 1, defaultPercent: 0, tone: 'neutral' },
      { id: 'stage_2', name: '企画・下準備', order: 2, defaultPercent: 25, tone: 'info' },
      { id: 'stage_3', name: '作業中', order: 3, defaultPercent: 50, tone: 'progress' },
      { id: 'stage_4', name: '局内確認中', order: 4, defaultPercent: 75, tone: 'review' },
      { id: 'stage_5', name: '完了', order: 5, defaultPercent: 100, tone: 'done' },
    ];
    for (const s of defaultStages) {
      batch.set(doc(db, 'projects', projectId, 'stages', s.id), {
        ...s,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    await syncWorkspaceSharedConfig(uid, projectId);
  } catch (error) {
    console.warn('Default stages backfill skipped:', error);
  }
}

export async function updateProjectMeta(
  projectId: string,
  data: {
    name: string;
    festivalDate: string;
    festivalEndDate: string;
    description: string;
  },
  uid?: string
): Promise<void> {
  const path = `projects/${projectId}`;
  const end = data.festivalEndDate >= data.festivalDate ? data.festivalEndDate : data.festivalDate;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      name: sanitizeString(data.name, FIELD_LIMITS.PROJECT_NAME_MAX) || '実行委員会ボード',
      festivalDate: data.festivalDate,
      festivalEndDate: end,
      description: sanitizeString(data.description, FIELD_LIMITS.PROJECT_DESC_MAX),
      updatedAt: serverTimestamp(),
    });
    if (uid) {
      await syncWorkspaceSharedConfig(uid, projectId);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProjectBoard(uid: string, projectId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    const deleteRefs = async (refs: ReturnType<typeof doc>[]) => {
      for (let i = 0; i < refs.length; i += 400) {
        const chunk = refs.slice(i, i + 400);
        const b = writeBatch(db);
        for (const r of chunk) b.delete(r);
        await b.commit();
      }
    };

    const allRefs: ReturnType<typeof doc>[] = [];
    const seenPaths = new Set<string>();
    const pushRef = (r: ReturnType<typeof doc>) => {
      if (!seenPaths.has(r.path)) {
        seenPaths.add(r.path);
        allRefs.push(r);
      }
    };

    const tasksSnap = await getDocs(
      query(collection(db, `projects/${projectId}/tasks`), where('ownerId', '==', uid))
    );
    const initsSnap = await getDocs(
      query(collection(db, `projects/${projectId}/initiatives`), where('ownerId', '==', uid))
    );

    const allTaskIds = new Set<string>(tasksSnap.docs.map((d) => d.id));
    for (const iDoc of initsSnap.docs) {
      const iData = iDoc.data() as Initiative;
      (iData.taskIds || []).forEach((tid) => allTaskIds.add(tid));
    }

    for (const tId of allTaskIds) {
      const tRef = doc(db, 'projects', projectId, 'tasks', tId);
      const tSnap = await getDoc(tRef);
      if (tSnap.exists()) {
        const tData = tSnap.data() as FestivalTask;
        (tData.noteIds || []).forEach((nId) =>
          pushRef(doc(db, 'projects', projectId, 'tasks', tId, 'notes', nId))
        );
        (tData.attachmentIds || []).forEach((aId) =>
          pushRef(doc(db, 'projects', projectId, 'tasks', tId, 'attachments', aId))
        );
      }
      const notesSnap = await getDocs(
        query(
          collection(db, `projects/${projectId}/tasks/${tId}/notes`),
          where('ownerId', '==', uid)
        )
      );
      notesSnap.docs.forEach((n) => pushRef(n.ref));

      const attSnap = await getDocs(
        query(
          collection(db, `projects/${projectId}/tasks/${tId}/attachments`),
          where('ownerId', '==', uid)
        )
      );
      attSnap.docs.forEach((a) => pushRef(a.ref));
      pushRef(tRef);
    }

    for (const iDoc of initsSnap.docs) {
      const iData = iDoc.data() as Initiative;
      (iData.noteIds || []).forEach((nId) =>
        pushRef(doc(db, 'projects', projectId, 'initiatives', iDoc.id, 'notes', nId))
      );
      const notesSnap = await getDocs(
        query(
          collection(db, `projects/${projectId}/initiatives/${iDoc.id}/notes`),
          where('ownerId', '==', uid)
        )
      );
      notesSnap.docs.forEach((n) => pushRef(n.ref));

      const membersSnap = await getDocs(
        query(
          collection(db, `projects/${projectId}/initiatives/${iDoc.id}/members`),
          where('ownerId', '==', uid)
        )
      );
      membersSnap.docs.forEach((m) => pushRef(m.ref));

      pushRef(iDoc.ref);
    }

    const collabsSnap = await getDocs(
      query(collection(db, `projects/${projectId}/collaborators`), where('ownerId', '==', uid))
    );
    collabsSnap.docs.forEach((c) => pushRef(c.ref));

    const invitesSnap = await getDocs(
      query(collection(db, 'projectInvites'), where('ownerId', '==', uid))
    );
    invitesSnap.docs
      .filter((d) => (d.data() as ProjectInvite).projectId === projectId)
      .forEach((d) => pushRef(d.ref));

    const sharedCfgSnap = await getDoc(doc(db, 'projects', projectId, 'sharedConfig', 'workspace'));
    if (sharedCfgSnap.exists()) {
      pushRef(sharedCfgSnap.ref);
    }

    const bureausSnap = await getDocs(
      query(collection(db, `projects/${projectId}/bureaus`), where('ownerId', '==', uid))
    );
    bureausSnap.docs.forEach((b) => pushRef(b.ref));

    const stagesSnap = await getDocs(
      query(collection(db, `projects/${projectId}/stages`), where('ownerId', '==', uid))
    );
    stagesSnap.docs.forEach((s) => pushRef(s.ref));

    const pubSnap = await getDoc(doc(db, 'publicEntry', 'default'));
    if (
      pubSnap.exists() &&
      (pubSnap.data() as PublicEntry).ownerId === uid &&
      (pubSnap.data() as PublicEntry).projectId === projectId
    ) {
      pushRef(pubSnap.ref);
    }

    await deleteRefs(allRefs);
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveInitiative(
  uid: string,
  projectId: string,
  input: {
    id?: string;
    name: string;
    description: string;
    colorKey: ColorKey;
    teamRefs: TeamRef[];
    startDate: string;
    endDate: string;
    deadlineDate?: string;
    stageId?: string;
    progressPercent?: number;
    isMilestone?: boolean;
    isVerified?: boolean;
    verifiedBy?: string;
  },
  isNew: boolean
): Promise<string> {
  const initiativeId = input.id && !isNew ? input.id : generateSafeId('init');
  const path = `projects/${projectId}/initiatives/${initiativeId}`;
  const safeEnd = input.endDate >= input.startDate ? input.endDate : input.startDate;
  const cleanRefs = input.teamRefs
    .slice(0, FIELD_LIMITS.MAX_TEAM_REFS_PER_INITIATIVE)
    .map((r) => ({ bureauId: r.bureauId, teamId: r.teamId }));
  const clampedPercent = Math.max(0, Math.min(100, Math.round(input.progressPercent ?? 0)));

  try {
    const payload: Record<string, unknown> = {
      name: sanitizeString(input.name, FIELD_LIMITS.INITIATIVE_NAME_MAX) || '新規プロジェクト',
      description: sanitizeString(input.description, FIELD_LIMITS.INITIATIVE_DESC_MAX),
      colorKey: input.colorKey,
      teamRefs: cleanRefs,
      startDate: input.startDate,
      endDate: safeEnd,
      deadlineDate: input.deadlineDate || '',
      progressPercent: clampedPercent,
      isMilestone: Boolean(input.isMilestone),
      isVerified: Boolean(input.isVerified),
      verifiedBy: sanitizeString(input.verifiedBy || '', FIELD_LIMITS.VERIFIED_BY_MAX),
      updatedAt: serverTimestamp(),
    };
    if (input.stageId !== undefined) {
      payload.stageId = input.stageId;
    }

    if (isNew) {
      await setDoc(doc(db, 'projects', projectId, 'initiatives', initiativeId), {
        ...payload,
        taskIds: [],
        noteIds: [],
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
      const entryRef = doc(db, 'publicEntry', 'default');
      const entrySnap = await getDoc(entryRef);
      if (entrySnap.exists()) {
        const entryData = entrySnap.data() as Omit<PublicEntry, 'id'>;
        if (
          entryData.ownerId === uid &&
          entryData.projectId === projectId &&
          entryData.accessScope === 'board'
        ) {
          await updateDoc(entryRef, {
            initiativeIds: arrayUnion(initiativeId),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } else {
      await updateDoc(doc(db, 'projects', projectId, 'initiatives', initiativeId), payload);
    }
    return initiativeId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function updateInitiativeQuickProgress(
  projectId: string,
  initiativeId: string,
  stageId: string,
  progressPercent: number
): Promise<void> {
  const path = `projects/${projectId}/initiatives/${initiativeId}`;
  const clampedPercent = Math.max(0, Math.min(100, Math.round(progressPercent)));
  try {
    await updateDoc(doc(db, 'projects', projectId, 'initiatives', initiativeId), {
      stageId,
      progressPercent: clampedPercent,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleInitiativeVerification(
  projectId: string,
  initiativeId: string,
  isVerified: boolean,
  verifiedBy: string
): Promise<void> {
  const path = `projects/${projectId}/initiatives/${initiativeId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'initiatives', initiativeId), {
      isVerified,
      verifiedBy: isVerified ? sanitizeString(verifiedBy, FIELD_LIMITS.VERIFIED_BY_MAX) : '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteInitiative(projectId: string, initiativeId: string): Promise<void> {
  const path = `projects/${projectId}/initiatives/${initiativeId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'initiatives', initiativeId));
    try {
      const entryRef = doc(db, 'publicEntry', 'default');
      const entrySnap = await getDoc(entryRef);
      if (entrySnap.exists()) {
        const entryData = entrySnap.data() as Omit<PublicEntry, 'id'>;
        if (entryData.projectId === projectId && (entryData.initiativeIds || []).includes(initiativeId)) {
          await updateDoc(entryRef, {
            initiativeIds: arrayRemove(initiativeId),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch {
      // Non-blocking cleanup
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addInitiativeNote(
  uid: string,
  projectId: string,
  initiativeId: string,
  input: {
    noteType: NoteType;
    content: string;
    authorName: string;
    authorBureau: string;
  }
): Promise<void> {
  const noteId = generateSafeId('note');
  const path = `projects/${projectId}/initiatives/${initiativeId}/notes/${noteId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'projects', projectId, 'initiatives', initiativeId, 'notes', noteId), {
      noteType: input.noteType,
      content: sanitizeString(input.content, FIELD_LIMITS.NOTE_CONTENT_MAX),
      authorName: sanitizeString(input.authorName, FIELD_LIMITS.AUTHOR_NAME_MAX) || '実行委員',
      authorBureau: sanitizeString(input.authorBureau, FIELD_LIMITS.AUTHOR_BUREAU_MAX),
      ownerId: uid,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'projects', projectId, 'initiatives', initiativeId), {
      noteIds: arrayUnion(noteId),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteInitiativeNote(
  projectId: string,
  initiativeId: string,
  noteId: string
): Promise<void> {
  const path = `projects/${projectId}/initiatives/${initiativeId}/notes/${noteId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'projects', projectId, 'initiatives', initiativeId, 'notes', noteId));
    batch.update(doc(db, 'projects', projectId, 'initiatives', initiativeId), {
      noteIds: arrayRemove(noteId),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTask(
  uid: string,
  projectId: string,
  input: {
    id?: string;
    title: string;
    description: string;
    bureauId: string;
    teamId: string;
    assigneeName: string;
    initiativeId?: string;
    previousInitiativeId?: string;
    stageId: string;
    progressPercent: number;
    startDate: string;
    endDate: string;
    deadlineDate?: string;
    isMilestone: boolean;
    isVerified: boolean;
    verifiedBy: string;
  },
  isNew: boolean
): Promise<string> {
  const taskId = input.id && !isNew ? input.id : generateSafeId('task');
  const path = `projects/${projectId}/tasks/${taskId}`;
  const safeEnd = input.endDate >= input.startDate ? input.endDate : input.startDate;
  const clampedPercent = Math.max(0, Math.min(100, Math.round(input.progressPercent)));
  const nextInitId = input.initiativeId || '';

  try {
    const payload = {
      title: sanitizeString(input.title, FIELD_LIMITS.TASK_TITLE_MAX) || '新規タスク',
      description: sanitizeString(input.description, FIELD_LIMITS.TASK_DESC_MAX),
      bureauId: input.bureauId,
      teamId: input.teamId,
      assigneeName: sanitizeString(input.assigneeName, FIELD_LIMITS.ASSIGNEE_MAX),
      initiativeId: nextInitId,
      stageId: input.stageId,
      progressPercent: clampedPercent,
      startDate: input.startDate,
      endDate: safeEnd,
      deadlineDate: input.deadlineDate || '',
      isMilestone: Boolean(input.isMilestone),
      isVerified: Boolean(input.isVerified),
      verifiedBy: sanitizeString(input.verifiedBy, FIELD_LIMITS.VERIFIED_BY_MAX),
      status: 'active' as const,
      updatedAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    const sharedCfgRef = doc(db, 'projects', projectId, 'sharedConfig', 'workspace');

    const prevInitId = input.previousInitiativeId;
    const needsCfgCheck =
      (isNew && !nextInitId) ||
      (!isNew && prevInitId !== undefined && prevInitId !== nextInitId && (!prevInitId || !nextInitId));
    const sharedCfgExists = needsCfgCheck ? (await getDoc(sharedCfgRef)).exists() : false;

    if (isNew) {
      batch.set(taskRef, {
        ...payload,
        noteIds: [],
        attachmentIds: [],
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
      if (nextInitId) {
        batch.update(doc(db, 'projects', projectId, 'initiatives', nextInitId), {
          taskIds: arrayUnion(taskId),
          updatedAt: serverTimestamp(),
        });
      } else if (sharedCfgExists) {
        batch.update(sharedCfgRef, {
          unassignedTaskIds: arrayUnion(taskId),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      batch.update(taskRef, payload);
      if (prevInitId !== undefined && prevInitId !== nextInitId) {
        if (prevInitId) {
          batch.update(
            doc(db, 'projects', projectId, 'initiatives', prevInitId),
            {
              taskIds: arrayRemove(taskId),
              updatedAt: serverTimestamp(),
            }
          );
        } else if (sharedCfgExists) {
          batch.update(sharedCfgRef, {
            unassignedTaskIds: arrayRemove(taskId),
            updatedAt: serverTimestamp(),
          });
        }

        if (nextInitId) {
          batch.update(doc(db, 'projects', projectId, 'initiatives', nextInitId), {
            taskIds: arrayUnion(taskId),
            updatedAt: serverTimestamp(),
          });
        } else if (sharedCfgExists) {
          batch.update(sharedCfgRef, {
            unassignedTaskIds: arrayUnion(taskId),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();
    return taskId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function updateTaskDates(
  projectId: string,
  taskId: string,
  startDate: string,
  endDate: string,
  deadlineDate: string
): Promise<void> {
  const path = `projects/${projectId}/tasks/${taskId}`;
  const safeEnd = endDate >= startDate ? endDate : startDate;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
      startDate,
      endDate: safeEnd,
      deadlineDate: deadlineDate || '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTaskQuickProgress(
  projectId: string,
  taskId: string,
  stageId: string,
  progressPercent: number
): Promise<void> {
  const path = `projects/${projectId}/tasks/${taskId}`;
  const clampedPercent = Math.max(0, Math.min(100, Math.round(progressPercent)));
  try {
    await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
      stageId,
      progressPercent: clampedPercent,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleTaskVerification(
  projectId: string,
  taskId: string,
  isVerified: boolean,
  verifiedBy: string
): Promise<void> {
  const path = `projects/${projectId}/tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
      isVerified,
      verifiedBy: isVerified ? sanitizeString(verifiedBy, FIELD_LIMITS.VERIFIED_BY_MAX) : '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTask(
  projectId: string,
  taskId: string,
  knownInitiativeId?: string
): Promise<void> {
  const path = `projects/${projectId}/tasks/${taskId}`;
  try {
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    let initId = knownInitiativeId || '';
    if (!initId) {
      const tSnap = await getDoc(taskRef);
      if (tSnap.exists()) {
        initId = ((tSnap.data() as FestivalTask).initiativeId || '');
      }
    }

    const batch = writeBatch(db);
    if (initId) {
      const initRef = doc(db, 'projects', projectId, 'initiatives', initId);
      const initSnap = await getDoc(initRef);
      if (initSnap.exists()) {
        batch.update(initRef, {
          taskIds: arrayRemove(taskId),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      const sharedCfgRef = doc(db, 'projects', projectId, 'sharedConfig', 'workspace');
      const sharedCfgSnap = await getDoc(sharedCfgRef);
      if (sharedCfgSnap.exists()) {
        batch.update(sharedCfgRef, {
          unassignedTaskIds: arrayRemove(taskId),
          updatedAt: serverTimestamp(),
        });
      }
    }
    batch.delete(taskRef);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addTaskNote(
  uid: string,
  projectId: string,
  taskId: string,
  input: {
    noteType: NoteType;
    content: string;
    authorName: string;
    authorBureau: string;
  }
): Promise<void> {
  const noteId = generateSafeId('note');
  const path = `projects/${projectId}/tasks/${taskId}/notes/${noteId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'projects', projectId, 'tasks', taskId, 'notes', noteId), {
      noteType: input.noteType,
      content: sanitizeString(input.content, FIELD_LIMITS.NOTE_CONTENT_MAX),
      authorName: sanitizeString(input.authorName, FIELD_LIMITS.AUTHOR_NAME_MAX) || '実行委員',
      authorBureau: sanitizeString(input.authorBureau, FIELD_LIMITS.AUTHOR_BUREAU_MAX),
      ownerId: uid,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'projects', projectId, 'tasks', taskId), {
      noteIds: arrayUnion(noteId),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTaskNote(
  projectId: string,
  taskId: string,
  noteId: string
): Promise<void> {
  const path = `projects/${projectId}/tasks/${taskId}/notes/${noteId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'projects', projectId, 'tasks', taskId, 'notes', noteId));
    batch.update(doc(db, 'projects', projectId, 'tasks', taskId), {
      noteIds: arrayRemove(noteId),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addTaskAttachment(
  uid: string,
  projectId: string,
  taskId: string,
  input: {
    title: string;
    kind: AttachmentKind;
    category: AttachmentCategory;
    url: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    dataUrl: string;
    uploadedBy: string;
  }
): Promise<string> {
  const attachmentId = generateSafeId('att');
  const path = `projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'projects', projectId, 'tasks', taskId, 'attachments', attachmentId), {
      title: sanitizeString(input.title, FIELD_LIMITS.ATTACHMENT_TITLE_MAX) || '添付資料',
      kind: input.kind,
      category: input.category,
      url: sanitizeString(input.url, FIELD_LIMITS.ATTACHMENT_URL_MAX),
      fileName: sanitizeString(input.fileName, FIELD_LIMITS.ATTACHMENT_FILENAME_MAX),
      mimeType: sanitizeString(input.mimeType, FIELD_LIMITS.ATTACHMENT_MIME_MAX),
      fileSize: Math.max(
        0,
        Math.min(FIELD_LIMITS.ATTACHMENT_FILE_MAX_BYTES, Math.round(input.fileSize))
      ),
      dataUrl: (input.dataUrl || '').slice(0, FIELD_LIMITS.ATTACHMENT_DATAURL_MAX),
      uploadedBy: sanitizeString(input.uploadedBy, FIELD_LIMITS.AUTHOR_NAME_MAX) || '実行委員',
      ownerId: uid,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'projects', projectId, 'tasks', taskId), {
      attachmentIds: arrayUnion(attachmentId),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return attachmentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTaskAttachment(
  projectId: string,
  taskId: string,
  attachmentId: string
): Promise<void> {
  const path = `projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'projects', projectId, 'tasks', taskId, 'attachments', attachmentId));
    batch.update(doc(db, 'projects', projectId, 'tasks', taskId), {
      attachmentIds: arrayRemove(attachmentId),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveBureau(
  uid: string,
  projectId: string,
  bureau: {
    id?: string;
    name: string;
    shortName: string;
    colorKey: ColorKey;
    order: number;
    teams: { id: string; name: string }[];
  },
  isNew: boolean
): Promise<string> {
  const bureauId = bureau.id && !isNew ? bureau.id : generateSafeId('bureau');
  const path = `projects/${projectId}/bureaus/${bureauId}`;
  const cleanTeams = bureau.teams
    .slice(0, FIELD_LIMITS.MAX_TEAMS_PER_BUREAU)
    .map((t) => ({
      id: t.id || generateSafeId('team'),
      name: sanitizeString(t.name, FIELD_LIMITS.TEAM_NAME_MAX) || '担当',
    }));

  try {
    if (isNew) {
      await setDoc(doc(db, 'projects', projectId, 'bureaus', bureauId), {
        name: sanitizeString(bureau.name, FIELD_LIMITS.BUREAU_NAME_MAX) || '新規局',
        shortName: sanitizeString(bureau.shortName, FIELD_LIMITS.BUREAU_SHORT_MAX) || '新規',
        colorKey: bureau.colorKey,
        order: bureau.order,
        teams: cleanTeams,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'projects', projectId, 'bureaus', bureauId), {
        name: sanitizeString(bureau.name, FIELD_LIMITS.BUREAU_NAME_MAX) || '新規局',
        shortName: sanitizeString(bureau.shortName, FIELD_LIMITS.BUREAU_SHORT_MAX) || '新規',
        colorKey: bureau.colorKey,
        order: bureau.order,
        teams: cleanTeams,
        updatedAt: serverTimestamp(),
      });
    }
    await syncWorkspaceSharedConfig(uid, projectId);
    return bureauId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteBureau(
  projectId: string,
  bureauId: string,
  uid?: string
): Promise<void> {
  const path = `projects/${projectId}/bureaus/${bureauId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'bureaus', bureauId));
    if (uid) {
      await syncWorkspaceSharedConfig(uid, projectId);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveStage(
  uid: string,
  projectId: string,
  stage: {
    id?: string;
    name: string;
    order: number;
    defaultPercent: number;
    tone: StageTone;
  },
  isNew: boolean
): Promise<string> {
  const stageId = stage.id && !isNew ? stage.id : generateSafeId('stage');
  const path = `projects/${projectId}/stages/${stageId}`;
  const clampedPercent = Math.max(0, Math.min(100, Math.round(stage.defaultPercent)));

  try {
    if (isNew) {
      await setDoc(doc(db, 'projects', projectId, 'stages', stageId), {
        name: sanitizeString(stage.name, FIELD_LIMITS.STAGE_NAME_MAX) || '新規段階',
        order: stage.order,
        defaultPercent: clampedPercent,
        tone: stage.tone,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'projects', projectId, 'stages', stageId), {
        name: sanitizeString(stage.name, FIELD_LIMITS.STAGE_NAME_MAX) || '新規段階',
        order: stage.order,
        defaultPercent: clampedPercent,
        tone: stage.tone,
        updatedAt: serverTimestamp(),
      });
    }
    await syncWorkspaceSharedConfig(uid, projectId);
    return stageId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteStage(
  projectId: string,
  stageId: string,
  uid?: string
): Promise<void> {
  const path = `projects/${projectId}/stages/${stageId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'stages', stageId));
    if (uid) {
      await syncWorkspaceSharedConfig(uid, projectId);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
