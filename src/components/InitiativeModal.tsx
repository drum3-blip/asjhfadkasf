import React, { useState } from 'react';
import { Diamond, Plus, Save, Trash2, Users, X } from 'lucide-react';
import {
  Bureau,
  BUREAU_COLORS,
  ColorKey,
  FIELD_LIMITS,
  Initiative,
  ProgressStage,
  STAGE_TONES,
  TeamRef,
} from '../types';
import { addDays, getTodayStr } from '../utils/dateUtils';
import { deleteInitiative, saveInitiative } from '../services/firestoreService';
import { CustomSelect } from './CustomSelect';

interface InitiativeModalProps {
  uid: string;
  projectId: string;
  bureaus: Bureau[];
  stages: ProgressStage[];
  initiative: Initiative | null;
  onClose: () => void;
}

export const InitiativeModal: React.FC<InitiativeModalProps> = ({
  uid,
  projectId,
  bureaus,
  stages,
  initiative,
  onClose,
}) => {
  const isNew = !initiative;
  const today = getTodayStr();
  const initialStage = stages.find((s) => s.id === initiative?.stageId) || stages[0] || null;

  const [name, setName] = useState(initiative?.name || '');
  const [description, setDescription] = useState(initiative?.description || '');
  const [colorKey, setColorKey] = useState<ColorKey>(initiative?.colorKey || 'teal');
  const [startDate, setStartDate] = useState(initiative?.startDate || today);
  const [endDate, setEndDate] = useState(initiative?.endDate || addDays(today, 14));
  const [deadlineDate, setDeadlineDate] = useState(initiative?.deadlineDate || '');
  const [stageId, setStageId] = useState(initiative?.stageId || initialStage?.id || '');
  const [progressPercent, setProgressPercent] = useState(
    initiative?.progressPercent ?? initialStage?.defaultPercent ?? 0
  );
  const [isMilestone, setIsMilestone] = useState(Boolean(initiative?.isMilestone));
  const [teamRefs, setTeamRefs] = useState<TeamRef[]>(initiative?.teamRefs || []);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSelectedTeam = (bureauId: string, teamId: string) =>
    teamRefs.some((r) => r.bureauId === bureauId && r.teamId === teamId);

  const toggleTeamRef = (bureauId: string, teamId: string) => {
    setTeamRefs((prev) => {
      const exists = prev.some((r) => r.bureauId === bureauId && r.teamId === teamId);
      if (exists) {
        return prev.filter((r) => !(r.bureauId === bureauId && r.teamId === teamId));
      }
      if (prev.length >= FIELD_LIMITS.MAX_TEAM_REFS_PER_INITIATIVE) return prev;
      return [...prev, { bureauId, teamId }];
    });
  };

  const handleStageChange = (nextId: string) => {
    setStageId(nextId);
    if (!nextId) {
      setProgressPercent(0);
      return;
    }
    const st = stages.find((s) => s.id === nextId);
    if (st) setProgressPercent(st.defaultPercent);
  };

  const colorOptions = Object.entries(BUREAU_COLORS).map(([k, v]) => ({
    value: k,
    label: v.label,
    swatchClass: v.swatch,
  }));

  const stageOptions = [
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
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('プロジェクト名を入力してください。');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await saveInitiative(
        uid,
        projectId,
        {
          id: initiative?.id,
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
          isVerified: initiative?.isVerified ?? false,
          verifiedBy: initiative?.verifiedBy ?? '',
        },
        isNew
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initiative) return;
    setSaving(true);
    try {
      await deleteInitiative(projectId, initiative.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? '新規プロジェクト作成' : 'プロジェクト編集'}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-bold text-slate-900">
            {isNew ? '新規プロジェクトを作成' : 'プロジェクト設定を編集'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              プロジェクト名 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.INITIATIVE_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 特別ゲスト講演会、メインステージ企画、模擬店衛生管理"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
              <label className="block text-xs font-medium text-slate-600 mb-1">識別カラー</label>
              <CustomSelect
                value={colorKey}
                options={colorOptions}
                onChange={(v) => setColorKey(v as ColorKey)}
                ariaLabel="識別カラー"
                className="w-full py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                初期進捗段階（任意）
              </label>
              <CustomSelect
                value={stageId}
                options={stageOptions}
                onChange={handleStageChange}
                ariaLabel="初期進捗段階（任意）"
                placeholder="（指定しない）"
                className="w-full py-2"
              />
            </div>

            <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={isMilestone}
                onChange={(e) => setIsMilestone(e.target.checked)}
                className="accent-blue-700"
              />
              <Diamond className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
              <span>重要マイルストーンとして強調する</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">概要・確認事項</label>
            <textarea
              rows={2}
              maxLength={FIELD_LIMITS.INITIATIVE_DESC_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="プロジェクトの到達目標や関係部署間の連携事項"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Multi-select participating teams across bureaus */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700" aria-hidden="true" />
                <span className="text-xs font-bold text-slate-900">
                  担当する局・担当（複数選択可）
                </span>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                選択中 {teamRefs.length}担当
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              同じプロジェクトを複数の局・担当が共同で担う場合は、該当する担当をすべてチェックしてください。
            </p>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-52 overflow-y-auto">
              {bureaus.map((b) => {
                const palette = BUREAU_COLORS[b.colorKey] || BUREAU_COLORS.slate;
                return (
                  <div key={b.id} className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-xs ${palette.swatch}`} />
                      <span className="text-xs font-semibold text-slate-800">{b.name}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-4">
                      {b.teams.map((tm) => {
                        const checked = isSelectedTeam(b.id, tm.id);
                        return (
                          <label
                            key={tm.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
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

          <div className="pt-2 flex items-center justify-between gap-3">
            <div>
              {!isNew &&
                (!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>削除</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      プロジェクトを削除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1.5 border border-slate-200 text-xs text-slate-600 rounded-lg cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                ))}
            </div>

            <div className="flex items-center gap-2.5">
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
                {isNew ? <Plus className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saving ? '保存中...' : isNew ? 'プロジェクトを作成' : '変更を保存'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
