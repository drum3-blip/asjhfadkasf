import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { CalendarDays, CheckSquare, GanttChartSquare, KeyRound, Layers3, LogIn } from 'lucide-react';
import { auth, googleProvider } from '../firebase';

interface AuthGateProps {
  errorMessage?: string | null;
  onEnterWithInviteCode?: (rawCodeOrUrl: string) => Promise<string | null>;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  errorMessage,
  onEnterWithInviteCode,
}) => {
  const [signingIn, setSigningIn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [inviteInput, setInviteInput] = useState('');
  const [enteringInvite, setEnteringInvite] = useState(false);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setLocalError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? `サインインに失敗しました: ${err.message}`
          : 'Googleサインインに失敗しました。ポップアップがブロックされていないか確認してください。'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onEnterWithInviteCode || !inviteInput.trim()) return;
    setEnteringInvite(true);
    setLocalError(null);
    try {
      const err = await onEnterWithInviteCode(inviteInput.trim());
      if (err) setLocalError(err);
    } finally {
      setEnteringInvite(false);
    }
  };

  const displayError = localError || errorMessage;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Product Overview */}
        <div className="lg:col-span-7 p-8 sm:p-10 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-blue-700 tracking-wide">
              大学祭実行委員会 プロジェクト統合管理
            </p>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug text-balance">
              局・担当を横断して、計画と進捗をひと目で確認。
            </h1>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              連絡やチャットのためのツールではなく、実行委員会全体のタスク期限・複数段階の進捗状況・確認記録を正確に把握するための管理ワークスペースです。
            </p>

            <dl className="mt-8 space-y-5 border-t border-slate-200 pt-6">
              <div className="flex items-start gap-3.5">
                <Layers3 className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <dt className="text-sm font-semibold text-slate-900">
                    局（総務・企画・広報など）× 担当の階層管理
                  </dt>
                  <dd className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                    各局とその配下の担当ごとに進捗率・段階内訳を集計し、ボトルネックを早期に特定できます。
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <GanttChartSquare className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <dt className="text-sm font-semibold text-slate-900">
                    複数段階の進捗度とインタラクティブ・ガントチャート
                  </dt>
                  <dd className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                    「未着手・準備・作業中・局内確認・最終承認待ち・完了」など、進捗段階のカスタマイズと進捗％の可視化に対応。
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <CalendarDays className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <dt className="text-sm font-semibold text-slate-900">
                    全体カレンダーと確認用コメントログ
                  </dt>
                  <dd className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                    全企画・全申請の期限をカレンダーで俯瞰。各タスクには連絡用ではない確認メモ・承認記録を残せます。
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </div>

        {/* Right: Sign In / Link Entry */}
        <div className="lg:col-span-5 p-8 sm:p-10 bg-slate-50/60 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
            <CheckSquare className="w-5 h-5 text-blue-700" aria-hidden="true" />
            <span>実行委員会 進捗統合ボード</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            共有リンクが有効な場合はログイン不要でそのまま入室できます。新しくボードを作成・管理する場合はGoogleアカウントでログインしてください。
          </p>

          {displayError && (
            <div className="mt-4 p-3 border border-red-200 bg-red-50 rounded-lg text-xs text-red-700 leading-relaxed">
              {displayError}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="mt-5 w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>{signingIn ? 'サインイン中...' : 'Googleアカウントで開始（管理者）'}</span>
          </button>

          {onEnterWithInviteCode && (
            <form onSubmit={handleInviteSubmit} className="mt-6 pt-5 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <KeyRound className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                <span>プロジェクト招待コード・URLで入室（ログイン不要）</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  placeholder="inv_... または招待URL"
                  className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                />
                <button
                  type="submit"
                  disabled={enteringInvite || !inviteInput.trim()}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  {enteringInvite ? '確認中...' : '入室'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
