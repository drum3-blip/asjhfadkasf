import React, { useState } from 'react';
import { FolderPlus, Layers3, UserPlus, X } from 'lucide-react';
import { FIELD_LIMITS } from '../types';
import { addDays, getTodayStr } from '../utils/dateUtils';
import { createEmptyProject, createProjectWithSeed } from '../services/firestoreService';

interface ProjectSetupScreenProps {
  uid: string;
  isModal?: boolean;
  pendingInvitesCount?: number;
  onOpenJoinModal?: () => void;
  onCreated: (projectId: string) => void;
  onCancel?: () => void;
}

export const ProjectSetupScreen: React.FC<ProjectSetupScreenProps> = ({
  uid,
  isModal = false,
  pendingInvitesCount = 0,
  onOpenJoinModal,
  onCreated,
  onCancel,
}) => {
  const today = getTodayStr();
  const [name, setName] = useState('');
  const [festivalDate, setFestivalDate] = useState(addDays(today, 21));
  const [festivalEndDate, setFestivalEndDate] = useState(addDays(today, 22));
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSample = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await createProjectWithSeed(uid);
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'サンプル作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createEmptyProject(uid, {
        name,
        festivalDate,
        festivalEndDate,
        description,
      });
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">大学祭プロジェクトの作成</h2>
        {isModal && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="閉じる"
            className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}

        {onOpenJoinModal && (
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <UserPlus className="w-4 h-4 text-blue-700" aria-hidden="true" />
                <span>
                  他メンバーから共有・招待されたプロジェクトに参加
                  {pendingInvitesCount > 0 ? `（招待 ${pendingInvitesCount}件）` : ''}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-600">
                招待リンクや招待コード、またはメール宛ての招待からすぐ参加できます。
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenJoinModal}
              className="px-3.5 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-blue-800 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              招待コード・招待を確認
            </button>
          </div>
        )}

        {/* Quick Sample Seed Card */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Layers3 className="w-4 h-4 text-blue-700" aria-hidden="true" />
              <span>標準実行委員会テンプレート（5局・13担当・6プロジェクト）</span>
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              総務・企画・ステージ・広報・模擬店財務の5局、6段階の進捗度、プロジェクト別の担当タスク構成を即座に生成して試用・編集できます。
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateSample}
            disabled={busy}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {busy ? '生成中...' : 'サンプル構成で開始'}
          </button>
        </div>

        {/* Custom Empty Project Form */}
        <form onSubmit={handleCreateCustom} className="space-y-4 pt-4 border-t border-slate-200">
          <h3 className="text-xs font-bold text-slate-800">または新規にゼロから作成</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              大学祭・プロジェクト名
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.PROJECT_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 第45回 楓祭 実行委員会"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">本番開始日</label>
              <input
                type="date"
                required
                value={festivalDate}
                onChange={(e) => setFestivalDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">本番終了日</label>
              <input
                type="date"
                required
                min={festivalDate}
                value={festivalEndDate}
                onChange={(e) => setFestivalEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">概要メモ</label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.PROJECT_DESC_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="開催テーマや運営方針など（任意）"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2">
            {isModal && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                キャンセル
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>空のプロジェクトを作成</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
        onClick={onCancel}
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
          {card}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">{card}</div>
  );
};
