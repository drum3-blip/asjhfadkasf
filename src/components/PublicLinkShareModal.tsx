import React, { useEffect, useState } from 'react';
import { Check, Copy, Globe, Lock, Save, Shield, X } from 'lucide-react';
import {
  BUREAU_COLORS,
  Initiative,
  InviteAccessRole,
  Project,
  PublicEntry,
  PublicEntryScope,
  PublicEntryStatus,
} from '../types';
import { PUBLIC_APP_URL, upsertPublicEntry } from '../services/firestoreService';

interface PublicLinkShareModalProps {
  uid: string;
  ownerName: string;
  project: Project;
  initiatives: Initiative[];
  publicEntry: PublicEntry | null;
  onClose: () => void;
}

export const PublicLinkShareModal: React.FC<PublicLinkShareModalProps> = ({
  uid,
  ownerName,
  project,
  initiatives,
  publicEntry,
  onClose,
}) => {
  const isPointingToCurrentBoard = publicEntry?.projectId === project.id;

  const [status, setStatus] = useState<PublicEntryStatus>(
    isPointingToCurrentBoard && publicEntry ? publicEntry.status : 'active'
  );
  const [accessScope, setAccessScope] = useState<PublicEntryScope>(
    isPointingToCurrentBoard && publicEntry ? publicEntry.accessScope : 'board'
  );
  const [role, setRole] = useState<InviteAccessRole>(
    isPointingToCurrentBoard && publicEntry ? publicEntry.role : 'editor'
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (isPointingToCurrentBoard && publicEntry && publicEntry.accessScope === 'selected') {
      return publicEntry.initiativeIds || [];
    }
    return initiatives.map((i) => i.id);
  });

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (publicEntry && publicEntry.projectId === project.id) {
      setStatus(publicEntry.status);
      setAccessScope(publicEntry.accessScope);
      setRole(publicEntry.role);
      if (publicEntry.accessScope === 'selected') {
        setSelectedIds(publicEntry.initiativeIds || []);
      }
    }
  }, [publicEntry, project.id]);

  const directUrl = `${PUBLIC_APP_URL}/`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(directUrl);
      setCopied(true);
      setNotice('共有リンクをコピーしました');
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setNotice(null), 2600);
    } catch {
      setErrorMsg('クリップボードへのコピーに失敗しました。URLを選択してコピーしてください。');
    }
  };

  const toggleInitiative = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'active' && accessScope === 'selected' && selectedIds.length === 0) {
      setErrorMsg('公開するプロジェクトを1つ以上選択してください。');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const targetInitiativeIds =
        accessScope === 'board' ? initiatives.map((i) => i.id) : selectedIds;
      await upsertPublicEntry(uid, ownerName, project, {
        status,
        accessScope,
        role,
        initiativeIds: targetInitiativeIds,
      });
      setNotice('リンク共有設定を保存しました');
      setTimeout(() => setNotice(null), 2600);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '共有設定の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="公開リンク共有設定"
    >
      <div
        className="w-full max-w-xl max-h-[90vh] bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900 truncate">
                ログインなし共有リンク設定
              </h2>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              アプリのURLを知っている人がGoogleログイン不要で入れる設定を管理します
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}
          {notice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
              {notice}
            </div>
          )}

          {/* Direct App Link Box */}
          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">共有用アプリURL</span>
              <span
                className={`text-[11px] font-semibold ${
                  status === 'active' ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {status === 'active'
                  ? 'ログイン不要でアクセス可能'
                  : '停止中（ログインが必要）'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={directUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs font-mono text-slate-800"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'コピー済み' : 'URLコピー'}</span>
              </button>
            </div>
            {publicEntry && !isPointingToCurrentBoard && (
              <p className="text-[11px] text-amber-800">
                現在このURLは別ボード「{publicEntry.projectName}」に紐づいています。保存すると「
                {project.name}」に切り替わります。
              </p>
            )}
          </div>

          {/* Toggle Active / Paused */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-900">1. リンクアクセスの状態</span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`p-3 border rounded-xl text-left transition-colors cursor-pointer ${
                  status === 'active'
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Globe className="w-4 h-4 text-blue-700" aria-hidden="true" />
                  <span>有効（ログイン不要）</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  URLを知っている全員がすぐに入室できます
                </p>
              </button>
              <button
                type="button"
                onClick={() => setStatus('paused')}
                className={`p-3 border rounded-xl text-left transition-colors cursor-pointer ${
                  status === 'paused'
                    ? 'border-slate-900 bg-slate-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Lock className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>一時停止</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  個別プロジェクト招待リンクまたはログインのみ
                </p>
              </button>
            </div>
          </div>

          {/* Role selection */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-900">2. リンク入室者の権限</span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRole('editor')}
                className={`p-3 border rounded-xl text-left transition-colors cursor-pointer ${
                  role === 'editor'
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">共同編集</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  担当タスク追加・進捗更新・資料添付・確認コメントが可能
                </p>
              </button>
              <button
                type="button"
                onClick={() => setRole('viewer')}
                className={`p-3 border rounded-xl text-left transition-colors cursor-pointer ${
                  role === 'viewer'
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">閲覧のみ</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  進捗や日程・添付資料の確認専用（編集不可）
                </p>
              </button>
            </div>
          </div>

          {/* Access Scope */}
          <div className="space-y-2.5">
            <span className="block text-xs font-bold text-slate-900">
              3. 「{project.name}」の公開範囲
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAccessScope('board')}
                className={`p-3 border rounded-xl text-left transition-colors cursor-pointer ${
                  accessScope === 'board'
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">ボード全体</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  すべてのプロジェクトとタスクを表示
                </p>
              </button>
              <button
                type="button"
                onClick={() => setAccessScope('selected')}
                className={`p-3 border rounded-xl text-left transition-colors cursor-pointer ${
                  accessScope === 'selected'
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">選んだプロジェクトのみ</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  指定したプロジェクトだけを表示
                </p>
              </button>
            </div>

            {accessScope === 'selected' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 max-h-44 overflow-y-auto">
                {initiatives.length === 0 ? (
                  <p className="text-xs text-slate-500">まだプロジェクトがありません。</p>
                ) : (
                  initiatives.map((init) => {
                    const checked = selectedIds.includes(init.id);
                    const palette = BUREAU_COLORS[init.colorKey] || BUREAU_COLORS.slate;
                    return (
                      <label
                        key={init.id}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInitiative(init.id)}
                          className="rounded border-slate-300 text-blue-700"
                        />
                        <span
                          className={`w-2.5 h-2.5 rounded-xs shrink-0 ${palette.swatch}`}
                          aria-hidden="true"
                        />
                        <span className="font-medium text-slate-900 truncate">{init.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2 text-[11px] text-slate-600 leading-relaxed">
            <Shield className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              ボードの削除・組織（局/担当）や進捗段階の設定・新規プロジェクト作成・共有設定の変更は、オーナー（あなた）のGoogleログイン時のみ実行できます。
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 rounded-lg cursor-pointer"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{saving ? '保存中...' : '設定を保存'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
