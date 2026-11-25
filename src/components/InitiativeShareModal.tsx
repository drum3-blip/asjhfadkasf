import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Link2,
  Mail,
  Share2,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  FIELD_LIMITS,
  Initiative,
  InitiativeMember,
  InviteAccessRole,
  Project,
  ProjectInvite,
} from '../types';
import {
  createInitiativeInvite,
  deleteProjectInvite,
  getShareBaseUrl,
  removeInitiativeMember,
  subscribeToInitiativeInvites,
  subscribeToInitiativeMembers,
  updateInitiativeMemberRole,
  updateProjectInvite,
} from '../services/firestoreService';
import { CustomSelect } from './CustomSelect';

interface InitiativeShareModalProps {
  uid: string;
  ownerName: string;
  project: Project;
  initiative: Initiative;
  onClose: () => void;
}

export const InitiativeShareModal: React.FC<InitiativeShareModalProps> = ({
  uid,
  ownerName,
  project,
  initiative,
  onClose,
}) => {
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [members, setMembers] = useState<InitiativeMember[]>([]);

  const [linkRole, setLinkRole] = useState<InviteAccessRole>('editor');
  const [emailInput, setEmailInput] = useState('');
  const [emailRole, setEmailRole] = useState<InviteAccessRole>('editor');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const unsubInvites = subscribeToInitiativeInvites(
      uid,
      project.id,
      initiative.id,
      setInvites
    );
    const unsubMembers = subscribeToInitiativeMembers(
      uid,
      project.id,
      initiative.id,
      setMembers
    );
    return () => {
      unsubInvites();
      unsubMembers();
    };
  }, [uid, project.id, initiative.id]);

  const roleOptions = [
    { value: 'editor', label: '共同編集（編集・追加可）' },
    { value: 'viewer', label: '閲覧のみ（読み取り専用）' },
  ];

  const compactRoleOptions = [
    { value: 'editor', label: '共同編集' },
    { value: 'viewer', label: '閲覧のみ' },
  ];

  const flashNotice = (msg: string) => {
    setErrorMsg(null);
    setNoticeMsg(msg);
    setTimeout(() => setNoticeMsg(null), 2600);
  };

  const buildShareUrl = (inviteId: string) => {
    const base = getShareBaseUrl();
    return `${base}/?invite=${encodeURIComponent(inviteId)}`;
  };

  const handleCopyText = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      flashNotice(`${label}をコピーしました`);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      setErrorMsg('クリップボードへのコピーに失敗しました。手動で選択してコピーしてください。');
    }
  };

  const handleCreateLinkInvite = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const id = await createInitiativeInvite(uid, ownerName, project, initiative, {
        inviteType: 'link',
        role: linkRole,
      });
      await handleCopyText(`url-${id}`, buildShareUrl(id), '共有リンク');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '共有リンクの作成に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await createInitiativeInvite(uid, ownerName, project, initiative, {
        inviteType: 'email',
        invitedEmail: trimmed,
        role: emailRole,
      });
      setEmailInput('');
      flashNotice(`${trimmed} 宛の招待を作成しました`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'メール招待の作成に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const linkInvites = invites.filter((i) => i.inviteType === 'link');
  const emailInvites = invites.filter((i) => i.inviteType === 'email');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="プロジェクトの共有設定"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900 truncate">
                プロジェクト共有: {initiative.name}
              </h2>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              他の実行委員にこのプロジェクトのみを公開・共同編集できます（同じボード内の他プロジェクトは非公開のままです）
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}
          {noticeMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
              {noticeMsg}
            </div>
          )}

          {/* Section 1: Invite via Shareable Link */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-700" aria-hidden="true" />
              <h3 className="text-xs font-bold text-slate-900">ログイン不要の共有リンク・コード</h3>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              このリンクや招待コードを共有すると、Googleログイン不要で相手がこのプロジェクトのみを閲覧・編集できます。
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-56">
                <CustomSelect
                  value={linkRole}
                  options={roleOptions}
                  onChange={(v) => setLinkRole(v as InviteAccessRole)}
                  ariaLabel="招待リンクの権限"
                  className="w-full"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleCreateLinkInvite}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{busy ? '発行中...' : '共有リンクを発行してコピー'}</span>
              </button>
            </div>

            {linkInvites.length > 0 && (
              <div className="pt-2 space-y-2">
                {linkInvites.map((inv) => {
                  const shareUrl = buildShareUrl(inv.id);
                  const isActive = inv.status === 'active';
                  return (
                    <div
                      key={inv.id}
                      className={`p-3 bg-white border rounded-lg space-y-2 ${
                        isActive ? 'border-slate-200' : 'border-slate-200 opacity-65'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`font-semibold ${
                              isActive ? 'text-emerald-700' : 'text-slate-500'
                            }`}
                          >
                            {isActive ? '有効なリンク' : '無効化済み'}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono text-[11px] text-slate-600">
                            コード: {inv.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <CustomSelect
                            value={inv.role}
                            options={compactRoleOptions}
                            onChange={(v) =>
                              updateProjectInvite(inv.id, { role: v as InviteAccessRole })
                            }
                            size="xs"
                            align="right"
                            ariaLabel="招待権限"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateProjectInvite(inv.id, {
                                status: isActive ? 'revoked' : 'active',
                              })
                            }
                            className="px-2 py-1 border border-slate-200 rounded text-[11px] text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                          >
                            {isActive ? '停止する' : '再開する'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProjectInvite(inv.id)}
                            aria-label="招待リンクを削除"
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isActive && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            onFocus={(e) => e.target.select()}
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-700"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopyText(`url-${inv.id}`, shareUrl, '共有URL')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-[11px] font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                          >
                            {copiedId === `url-${inv.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>URLコピー</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyText(`code-${inv.id}`, inv.id, '招待コード')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-[11px] font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                          >
                            {copiedId === `code-${inv.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>コードコピー</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Invite by Google Email */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-700" aria-hidden="true" />
              <h3 className="text-xs font-bold text-slate-900">Googleメールアドレスを指定して招待</h3>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              招待先の相手がこのアプリに同じGoogleアカウントでサインインすると、画面上部に招待通知が自動で表示されます。
            </p>

            <form onSubmit={handleCreateEmailInvite} className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                required
                maxLength={FIELD_LIMITS.INVITE_EMAIL_MAX}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="example@university.ac.jp / gmail.com"
                className="flex-1 min-w-[210px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
              />
              <div className="w-36">
                <CustomSelect
                  value={emailRole}
                  options={compactRoleOptions}
                  onChange={(v) => setEmailRole(v as InviteAccessRole)}
                  ariaLabel="メール招待の権限"
                  className="w-full"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !emailInput.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>招待を送信</span>
              </button>
            </form>

            {emailInvites.length > 0 && (
              <div className="pt-2 divide-y divide-slate-200 bg-white border border-slate-200 rounded-lg">
                {emailInvites.map((inv) => {
                  const isActive = inv.status === 'active';
                  return (
                    <div
                      key={inv.id}
                      className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{inv.invitedEmail}</p>
                        <p className="text-[11px] text-slate-500">
                          {isActive ? '招待中（相手がサインインすると参加できます）' : '停止中'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <CustomSelect
                          value={inv.role}
                          options={compactRoleOptions}
                          onChange={(v) =>
                            updateProjectInvite(inv.id, { role: v as InviteAccessRole })
                          }
                          size="xs"
                          align="right"
                          ariaLabel="招待権限"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateProjectInvite(inv.id, {
                              status: isActive ? 'revoked' : 'active',
                            })
                          }
                          className="px-2 py-1 border border-slate-200 rounded text-[11px] text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          {isActive ? '停止' : '再開'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProjectInvite(inv.id)}
                          aria-label="招待を削除"
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Active Collaborator Members */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700" aria-hidden="true" />
                <h3 className="text-xs font-bold text-slate-900">
                  現在の共有メンバー ({members.length + 1}名)
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Shield className="w-3 h-3" aria-hidden="true" />
                権限は即時に反映されます
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 bg-white">
              {/* Owner row */}
              <div className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{ownerName}</p>
                  <p className="text-[11px] text-slate-500">あなた</p>
                </div>
                <span className="text-xs font-semibold text-blue-700 shrink-0">オーナー</span>
              </div>

              {members.length === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-500 text-center">
                  まだ他の参加メンバーはいません。上のリンクまたはメール招待から共有できます。
                </p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{m.displayName}</p>
                      <p className="text-[11px] text-slate-500">
                        {m.role === 'editor'
                          ? 'タスク追加・進捗更新・資料添付が可能'
                          : '閲覧のみ（変更不可）'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <CustomSelect
                        value={m.role}
                        options={compactRoleOptions}
                        onChange={(v) =>
                          updateInitiativeMemberRole(
                            project.id,
                            initiative.id,
                            m.uid,
                            v as InviteAccessRole
                          )
                        }
                        size="xs"
                        align="right"
                        ariaLabel={`${m.displayName}の権限`}
                      />
                      <button
                        type="button"
                        onClick={() => removeInitiativeMember(project.id, initiative.id, m.uid)}
                        className="px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded cursor-pointer whitespace-nowrap"
                      >
                        共有解除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
