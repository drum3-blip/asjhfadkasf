import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import {
  Bureau,
  BUREAU_COLORS,
  ColorKey,
  FIELD_LIMITS,
  ProgressStage,
  Project,
  STAGE_TONES,
  StageTone,
} from '../types';
import {
  deleteBureau,
  deleteProjectBoard,
  deleteStage,
  generateSafeId,
  saveBureau,
  saveStage,
  updateProjectMeta,
} from '../services/firestoreService';
import { CustomSelect } from './CustomSelect';

export type SettingsTabKey = 'bureaus' | 'stages' | 'project';

interface OrgAndStagesModalProps {
  uid: string;
  project: Project;
  bureaus: Bureau[];
  stages: ProgressStage[];
  initialTab?: SettingsTabKey;
  onDeletedProject?: () => void;
  onClose: () => void;
}

export const OrgAndStagesModal: React.FC<OrgAndStagesModalProps> = ({
  uid,
  project,
  bureaus,
  stages,
  initialTab = 'bureaus',
  onDeletedProject,
  onClose,
}) => {
  const [tab, setTab] = useState<SettingsTabKey>(initialTab);

  // New Bureau State
  const [newBureauName, setNewBureauName] = useState('');
  const [newBureauShort, setNewBureauShort] = useState('');
  const [newBureauColor, setNewBureauColor] = useState<ColorKey>('sky');
  const [newTeamInputs, setNewTeamInputs] = useState<Record<string, string>>({});

  // New Stage State
  const [newStageName, setNewStageName] = useState('');
  const [newStagePercent, setNewStagePercent] = useState(50);
  const [newStageTone, setNewStageTone] = useState<StageTone>('progress');

  // Board (Project) Meta State
  const [projName, setProjName] = useState(project.name);
  const [projStart, setProjStart] = useState(project.festivalDate);
  const [projEnd, setProjEnd] = useState(project.festivalEndDate);
  const [projDesc, setProjDesc] = useState(project.description);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(false);
  const [deletingBoard, setDeletingBoard] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const colorOptions = Object.entries(BUREAU_COLORS).map(([k, v]) => ({
    value: k,
    label: v.label,
    swatchClass: v.swatch,
  }));

  const stageToneOptions = Object.entries(STAGE_TONES).map(([k, v]) => ({
    value: k,
    label: v.label,
    swatchClass: v.indicatorClass,
    textClass: v.textClass,
  }));

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setProjName(project.name);
    setProjStart(project.festivalDate);
    setProjEnd(project.festivalEndDate);
    setProjDesc(project.description);
    setConfirmDeleteBoard(false);
  }, [project]);

  const flashStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2200);
  };

  const handleAddBureau = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBureauName.trim()) return;
    await saveBureau(
      uid,
      project.id,
      {
        name: newBureauName.trim(),
        shortName: newBureauShort.trim() || newBureauName.trim().slice(0, 4),
        colorKey: newBureauColor,
        order: bureaus.length + 1,
        teams: [{ id: generateSafeId('team'), name: '主担当' }],
      },
      true
    );
    setNewBureauName('');
    setNewBureauShort('');
    flashStatus('局を追加しました');
  };

  const handleAddTeamToBureau = async (bureau: Bureau) => {
    const teamName = (newTeamInputs[bureau.id] || '').trim();
    if (!teamName || bureau.teams.length >= FIELD_LIMITS.MAX_TEAMS_PER_BUREAU) return;
    await saveBureau(
      uid,
      project.id,
      {
        id: bureau.id,
        name: bureau.name,
        shortName: bureau.shortName,
        colorKey: bureau.colorKey,
        order: bureau.order,
        teams: [...bureau.teams, { id: generateSafeId('team'), name: teamName }],
      },
      false
    );
    setNewTeamInputs((prev) => ({ ...prev, [bureau.id]: '' }));
    flashStatus('担当を追加しました');
  };

  const handleRemoveTeamFromBureau = async (bureau: Bureau, teamId: string) => {
    if (bureau.teams.length <= 1) return;
    await saveBureau(
      uid,
      project.id,
      {
        id: bureau.id,
        name: bureau.name,
        shortName: bureau.shortName,
        colorKey: bureau.colorKey,
        order: bureau.order,
        teams: bureau.teams.filter((t) => t.id !== teamId),
      },
      false
    );
    flashStatus('担当を削除しました');
  };

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;
    await saveStage(
      uid,
      project.id,
      {
        name: newStageName.trim(),
        order: stages.length + 1,
        defaultPercent: newStagePercent,
        tone: newStageTone,
      },
      true
    );
    setNewStageName('');
    flashStatus('進捗段階を追加しました');
  };

  const handleUpdateStageInline = async (
    stage: ProgressStage,
    patch: Partial<Pick<ProgressStage, 'name' | 'defaultPercent' | 'tone' | 'order'>>
  ) => {
    await saveStage(
      uid,
      project.id,
      {
        id: stage.id,
        name: patch.name ?? stage.name,
        order: patch.order ?? stage.order,
        defaultPercent: patch.defaultPercent ?? stage.defaultPercent,
        tone: patch.tone ?? stage.tone,
      },
      false
    );
    flashStatus('進捗段階を更新しました');
  };

  const handleSaveProjectMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProjectMeta(
      project.id,
      {
        name: projName,
        festivalDate: projStart,
        festivalEndDate: projEnd >= projStart ? projEnd : projStart,
        description: projDesc,
      },
      uid
    );
    flashStatus('ボード情報を保存しました');
  };

  const handleDeleteBoard = async () => {
    setDeletingBoard(true);
    try {
      await deleteProjectBoard(uid, project.id);
      onDeletedProject?.();
      onClose();
    } finally {
      setDeletingBoard(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="組織・進捗段階・ボード設定"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-900">ボード・組織・進捗段階の設定</h2>
            {statusMessage && (
              <span className="text-xs font-medium text-emerald-700">{statusMessage}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 flex items-center gap-6 text-xs font-medium">
          {(
            [
              { id: 'bureaus', label: '局・担当の構成' },
              { id: 'stages', label: '進捗段階のカスタマイズ' },
              { id: 'project', label: 'ボード編集・削除' },
            ] as { id: SettingsTabKey; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                tab === t.id
                  ? 'border-blue-700 text-blue-800 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'bureaus' && (
            <>
              <form
                onSubmit={handleAddBureau}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    新しい局名
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.BUREAU_NAME_MAX}
                    value={newBureauName}
                    onChange={(e) => setNewBureauName(e.target.value)}
                    placeholder="例: 警備・安全局"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    略称（カレンダー表示用）
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.BUREAU_SHORT_MAX}
                    value={newBureauShort}
                    onChange={(e) => setNewBureauShort(e.target.value)}
                    placeholder="例: 警備"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">色</label>
                  <CustomSelect
                    value={newBureauColor}
                    options={colorOptions}
                    onChange={(v) => setNewBureauColor(v as ColorKey)}
                    ariaLabel="局の色"
                    className="w-full"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>局を追加</span>
                  </button>
                </div>
              </form>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {bureaus.map((b) => {
                  const palette = BUREAU_COLORS[b.colorKey] || BUREAU_COLORS.slate;
                  return (
                    <div key={b.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3 h-3 rounded-xs ${palette.swatch}`} />
                          <span className="text-sm font-bold text-slate-900">{b.name}</span>
                          <span className="text-xs text-slate-500">({b.shortName})</span>
                        </div>
                        {bureaus.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteBureau(project.id, b.id, uid)}
                            className="text-xs text-red-600 hover:underline cursor-pointer"
                          >
                            この局を削除
                          </button>
                        )}
                      </div>

                      <div className="pl-5 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {b.teams.map((tm) => (
                            <div
                              key={tm.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700"
                            >
                              <span>{tm.name}</span>
                              {b.teams.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTeamFromBureau(b, tm.id)}
                                  aria-label={`${tm.name}を削除`}
                                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 max-w-sm">
                          <input
                            type="text"
                            maxLength={FIELD_LIMITS.TEAM_NAME_MAX}
                            value={newTeamInputs[b.id] || ''}
                            onChange={(e) =>
                              setNewTeamInputs((prev) => ({ ...prev, [b.id]: e.target.value }))
                            }
                            placeholder="この局に担当を追加..."
                            className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddTeamToBureau(b)}
                            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                          >
                            担当追加
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'stages' && (
            <>
              <p className="text-xs text-slate-600 leading-relaxed">
                実行委員会の承認フローに合わせて、進捗段階（例：「企画提出済」「局内確認」「総務確認待ち」「完了」など）を自由に追加・調整できます。
              </p>

              <form
                onSubmit={handleAddStage}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    段階名
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.STAGE_NAME_MAX}
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="例: 業者発注確認中"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    標準進捗 (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newStagePercent}
                    onChange={(e) =>
                      setNewStagePercent(Math.max(0, Math.min(100, Number(e.target.value))))
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">系統</label>
                  <CustomSelect
                    value={newStageTone}
                    options={stageToneOptions}
                    onChange={(v) => setNewStageTone(v as StageTone)}
                    ariaLabel="段階の系統"
                    className="w-full"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>段階追加</span>
                  </button>
                </div>
              </form>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {stages.map((st) => {
                  const tone = STAGE_TONES[st.tone] || STAGE_TONES.neutral;
                  return (
                    <div
                      key={st.id}
                      className="p-3.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-[180px]">
                        <span className={`w-3 h-3 rounded-xs shrink-0 ${tone.indicatorClass}`} />
                        <input
                          type="text"
                          defaultValue={st.name}
                          maxLength={FIELD_LIMITS.STAGE_NAME_MAX}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== st.name) {
                              handleUpdateStageInline(st, { name: val });
                            }
                          }}
                          className="px-2.5 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-900 w-full max-w-[200px]"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-500">標準%</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={st.defaultPercent}
                          onBlur={(e) => {
                            const num = Math.max(0, Math.min(100, Number(e.target.value)));
                            if (num !== st.defaultPercent) {
                              handleUpdateStageInline(st, { defaultPercent: num });
                            }
                          }}
                          className="w-16 px-2 py-1 border border-slate-200 rounded text-xs font-mono tabular-nums text-slate-800"
                        />

                        <CustomSelect
                          value={st.tone}
                          options={stageToneOptions}
                          onChange={(v) =>
                            handleUpdateStageInline(st, { tone: v as StageTone })
                          }
                          ariaLabel={`${st.name}の系統`}
                          size="xs"
                          align="right"
                          className="min-w-[140px]"
                        />

                        {stages.length > 2 && (
                          <button
                            type="button"
                            onClick={() => deleteStage(project.id, st.id, uid)}
                            aria-label={`${st.name}を削除`}
                            className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'project' && (
            <div className="space-y-8 max-w-xl">
              <form onSubmit={handleSaveProjectMeta} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ボード名（実行委員会・年度名）
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.PROJECT_NAME_MAX}
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      大学祭 本番開始日
                    </label>
                    <input
                      type="date"
                      required
                      value={projStart}
                      onChange={(e) => setProjStart(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      大学祭 本番終了日
                    </label>
                    <input
                      type="date"
                      required
                      min={projStart}
                      value={projEnd}
                      onChange={(e) => setProjEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">概要メモ</label>
                  <textarea
                    rows={3}
                    maxLength={FIELD_LIMITS.PROJECT_DESC_MAX}
                    value={projDesc}
                    onChange={(e) => setProjDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>ボード情報を保存</span>
                </button>
              </form>

              {/* Delete Board Section */}
              <div className="pt-6 border-t border-slate-200">
                <h3 className="text-xs font-bold text-red-700">このボードを削除</h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  ボード「{project.name}」と、その配下にあるプロジェクト・タスク・添付資料・確認メモをすべて削除します。この操作は元に戻せません。
                </p>

                <div className="mt-3">
                  {!confirmDeleteBoard ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteBoard(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>このボードを削除する</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <span className="text-xs font-medium text-red-900">
                        本当に削除しますか？
                      </span>
                      <button
                        type="button"
                        disabled={deletingBoard}
                        onClick={handleDeleteBoard}
                        className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        {deletingBoard ? '削除中...' : '完全に削除する'}
                      </button>
                      <button
                        type="button"
                        disabled={deletingBoard}
                        onClick={() => setConfirmDeleteBoard(false)}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-xs text-slate-700 rounded-lg cursor-pointer"
                      >
                        キャンセル
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
