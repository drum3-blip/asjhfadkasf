import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { CheckCircle2, Link2, Mail, Search, UserPlus, X } from 'lucide-react';
import { ProjectInvite } from '../types';
import { acceptProjectInvite, getInviteByCode } from '../services/firestoreService';

interface InviteJoinModalProps {
  user: User | null;
  initialInviteCode?: string | null;
  pendingEmailInvites: ProjectInvite[];
  joinedInitiativeKeys: Set<string>;
  onJoined: (projectId: string, initiativeId: string) => void;
  onGuestOpenInvite?: (invite: ProjectInvite) => void;
  onClose: () => void;
}

export const InviteJoinModal: React.FC<InviteJoinModalProps> = ({
  user,
  initialInviteCode,
  pendingEmailInvites,
  joinedInitiativeKeys,
  onJoined,
  onGuestOpenInvite,
  onClose,
}) => {
  const [codeInput, setCodeInput] = useState(initialInviteCode || '');
  const [lookupInvite, setLookupInvite] = useState<ProjectInvite | null>(null);
  const [searching, setSearching] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLookup = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    setSearching(true);
    setErrorMsg(null);
    setLookupInvite(null);
    try {
      const inv = await getInviteByCode(trimmed);
      if (!inv) {
        setErrorMsg('該当する有効な招待が見つかりません。コード・URL、または権限をご確認ください。');
        return;
      }
      if (inv.status !== 'active') {
        setErrorMsg('この招待リンク・コードは現在停止されています。オーナーにお問い合わせください。');
        return;
      }
      setLookupInvite(inv);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '招待情報の取得に失敗しました。');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (initialInviteCode) {
      setCodeInput(initialInviteCode);
      handleLookup(initialInviteCode);
    }
  }, [initialInviteCode]);

  const handleJoin = async (invite: ProjectInvite) => {
    if (!user) {
      if (invite.inviteType !== 'link') {
        setErrorMsg('メール宛の招待を開くにはGoogleアカウントでログインしてください。');
        return;
      }
      onGuestOpenInvite?.(invite);
      return;
    }
    setJoiningId(invite.id);
    setErrorMsg(null);
    try {
      const res = await acceptProjectInvite(user, invite);
      onJoined(res.projectId, res.initiativeId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'プロジェクトへの参加に失敗しました。');
    } finally {
      setJoiningId(null);
    }
  };

  const unjoinedEmailInvites = pendingEmailInvites.filter(
    (inv) => !joinedInitiativeKeys.has(`${inv.projectId}__${inv.initiativeId}`)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="共有プロジェクトに参加"
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">共有されたプロジェクトに参加</h2>
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

        <div className="p-6 space-y-6 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Pending Email Invites */}
          {unjoinedEmailInvites.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Mail className="w-4 h-4 text-blue-700" aria-hidden="true" />
                <span>あなた宛のメール招待 ({unjoinedEmailInvites.length}件)</span>
              </div>
              <div className="space-y-2">
                {unjoinedEmailInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {inv.initiativeName}
                      </p>
                      <p className="text-[11px] text-slate-600 truncate">
                        ボード: {inv.projectName} · 招待者: {inv.ownerName}
                      </p>
                      <p className="text-[11px] font-medium text-blue-800 mt-0.5">
                        権限: {inv.role === 'editor' ? '共同編集（編集・追加可）' : '閲覧のみ'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={joiningId === inv.id}
                      onClick={() => handleJoin(inv)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{joiningId === inv.id ? '参加中...' : '参加する'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Link / Code Lookup */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup(codeInput);
            }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Link2 className="w-4 h-4 text-slate-700" aria-hidden="true" />
              <span>招待リンクURL または 招待コードで参加</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="https://...?invite=inv_... または inv_..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
              />
              <button
                type="submit"
                disabled={searching || !codeInput.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{searching ? '確認中...' : '確認'}</span>
              </button>
            </div>
          </form>

          {lookupInvite && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div>
                <p className="text-[11px] text-slate-500">ボード: {lookupInvite.projectName}</p>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {lookupInvite.initiativeName}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span>オーナー: {lookupInvite.ownerName}</span>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-semibold text-blue-700">
                    {lookupInvite.role === 'editor'
                      ? '共同編集（編集・タスク追加可）'
                      : '閲覧のみ（読み取り専用）'}
                  </span>
                </div>
              </div>

              {user && lookupInvite.ownerId === user.uid ? (
                <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  あなたはこのプロジェクトの作成者（オーナー）です。
                </p>
              ) : user &&
                joinedInitiativeKeys.has(
                  `${lookupInvite.projectId}__${lookupInvite.initiativeId}`
                ) ? (
                <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                  <span className="text-xs font-medium text-emerald-800">
                    このプロジェクトにはすでに参加しています。
                  </span>
                  <button
                    type="button"
                    onClick={() => onJoined(lookupInvite.projectId, lookupInvite.initiativeId)}
                    className="px-3 py-1 bg-emerald-700 text-white text-xs font-semibold rounded-md cursor-pointer"
                  >
                    開く
                  </button>
                </div>
              ) : !user && lookupInvite.inviteType !== 'link' ? (
                <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  この招待はGoogleメールアドレス指定のため、Googleログインが必要です。
                </p>
              ) : (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={joiningId === lookupInvite.id}
                    onClick={() => handleJoin(lookupInvite)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {joiningId === lookupInvite.id
                        ? '参加処理中...'
                        : user
                          ? 'このプロジェクトに参加する'
                          : 'ログインせずに開く'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
