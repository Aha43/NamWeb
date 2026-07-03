import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Download, KeyRound, LogOut, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { buildUserExport, downloadJson } from '@/lib/exportData';
import { validateNewPassword } from '@/lib/password';
import { formatDate, type DateFormat } from '@/lib/dates';
import { useSettings, type BookmarkStyle } from '@/components/settings/settings-context';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@/lib/i18n';

const SAMPLE_ISO = '2026-06-14';
const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'medium', label: 'account.fmtMedium' },
  { value: 'iso', label: 'account.fmtIso' },
  { value: 'dmy', label: 'account.fmtDmy' },
  { value: 'mdy', label: 'account.fmtMdy' },
];

export type SettingsTab = 'account' | 'preferences';

/** The tab strip + active tab body — shared by the full Account page and the right settings
 *  panel (#599), so the two surfaces can't drift. */
export function AccountSettingsTabs({
  tab,
  onTabChange,
}: {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div role="tablist" className="mt-4 flex gap-1 border-b border-border">
        {(['account', 'preferences'] as SettingsTab[]).map((tabKey) => (
          <button
            key={tabKey}
            role="tab"
            aria-selected={tab === tabKey}
            onClick={() => onTabChange(tabKey)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors',
              tab === tabKey
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(tabKey === 'account' ? 'account.tabAccount' : 'account.tabPreferences')}
          </button>
        ))}
      </div>

      <div className="mt-6">{tab === 'account' ? <AccountTab /> : <PreferencesTab />}</div>
    </>
  );
}

/** The Settings/Account home: identity/security on the Account tab, device preferences on
 *  Preferences. The full-page surface (phone + direct `/account` links); on desktop the
 *  AccountMenu opens the same tabs in the right settings panel instead (#599). */
export function AccountPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: SettingsTab = params.get('tab') === 'preferences' ? 'preferences' : 'account';
  const setTab = (next: SettingsTab) =>
    setParams(next === 'account' ? {} : { tab: next }, { replace: true });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t('nav.settings')}</h1>
      <AccountSettingsTabs tab={tab} onTabChange={setTab} />
    </div>
  );
}

function AccountTab() {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function onExport() {
    setExporting(true);
    setExportError(null);
    try {
      downloadJson(await buildUserExport(supabase));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('account.exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Label>{t('account.email')}</Label>
        <p className="text-sm text-foreground">{email ?? '…'}</p>
      </div>

      <div className="space-y-1.5">
        <Button variant="secondary" onClick={onExport} disabled={exporting} className="gap-2">
          <Download className="h-4 w-4" />
          {exporting ? t('account.preparing') : t('account.exportData')}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t('account.exportHelp')}
        </p>
        {exportError && (
          <p role="alert" className="text-sm text-destructive">
            {exportError}
          </p>
        )}
      </div>

      <InviteFriend />

      <ChangePassword />

      <Button variant="outline" onClick={() => void supabase.auth.signOut()} className="gap-2">
        <LogOut className="h-4 w-4" />
        {t('nav.signOut')}
      </Button>

      <DeleteAccount />
    </div>
  );
}

function InviteFriend() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/?invite=1`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable; the link is shown so the user can copy manually
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{t('account.inviteTitle')}</p>
      <Button variant="secondary" onClick={copy} className="gap-2">
        {copied ? <Copy className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {copied ? t('account.linkCopied') : t('account.copyInvite')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t('account.inviteHelp')}
      </p>
    </div>
  );
}

function DeleteAccount() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportFirst() {
    try {
      downloadJson(await buildUserExport(supabase));
    } catch {
      // best-effort nudge; the dedicated Export button surfaces errors
    }
  }

  async function onDelete() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc('delete_my_account');
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    await supabase.auth.signOut(); // App reacts → back to the auth screen
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/40 p-4">
      <p className="text-sm font-medium text-destructive">{t('account.dangerZone')}</p>
      <p className="text-xs text-muted-foreground">
        {t('account.deleteHelp')}
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)} className="gap-2">
        <Trash2 className="h-4 w-4" />
        {t('account.deleteAccount')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setConfirmText('');
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('account.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('account.deleteDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button variant="outline" onClick={exportFirst} className="gap-2">
              <Download className="h-4 w-4" />
              {t('account.exportFirst')}
            </Button>
            <div>
              <Label htmlFor="confirm-delete" className="text-xs text-muted-foreground">
                {t('account.typeDelete')}
              </Label>
              <input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={busy || confirmText !== 'DELETE'}
              onClick={onDelete}
            >
              {busy ? t('account.deleting') : t('account.deleteAccount')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChangePassword() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);
    const pwError = validateNewPassword(password, confirm);
    if (pwError) {
      setError(pwError);
      return;
    }
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) {
      setError(e.message);
    } else {
      setDone(true);
      setPassword('');
      setConfirm('');
    }
  }

  const field =
    'mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring';

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <p className="text-sm font-medium text-foreground">{t('account.changePassword')}</p>
      <div>
        <Label htmlFor="new-password" className="text-xs text-muted-foreground">
          {t('account.newPassword')}
        </Label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
      </div>
      <div>
        <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">
          {t('account.confirmPassword')}
        </Label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={field}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={busy} className="gap-2">
        <KeyRound className="h-4 w-4" />
        {busy ? t('account.saving') : t('account.updatePassword')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {done && <p className="text-sm text-muted-foreground">{t('account.passwordUpdated')}</p>}
    </form>
  );
}

function PreferencesTab() {
  const {
    dateFormat,
    setDateFormat,
    language,
    setLanguage,
    bookmarkStyle,
    setBookmarkStyle,
    dense,
    setDense,
    addToBottomDefault,
    setAddToBottomDefault,
  } = useSettings();
  const { t, i18n } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="settings-language">{t('settings.language')}</Label>
        <select
          id="settings-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Locale)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
        >
          {Object.entries(LOCALES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{t('settings.languageHelp')}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-date-format">{t('account.dateFormat')}</Label>
        <select
          id="settings-date-format"
          value={dateFormat}
          onChange={(e) => setDateFormat(e.target.value as DateFormat)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
        >
          {DATE_FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.label)} — {formatDate(SAMPLE_ISO, opt.value, i18n.language)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {t('account.dateFormatHelp')}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-bookmark-style">{t('settings.bookmarkStyle')}</Label>
        <select
          id="settings-bookmark-style"
          value={bookmarkStyle}
          onChange={(e) => setBookmarkStyle(e.target.value as BookmarkStyle)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
        >
          <option value="icons">{t('settings.bookmarkStyleIcons')}</option>
          <option value="labels">{t('settings.bookmarkStyleLabels')}</option>
        </select>
        <p className="text-xs text-muted-foreground">{t('settings.bookmarkStyleHelp')}</p>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={dense}
            onChange={(e) => setDense(e.target.checked)}
            className="mt-0.5"
          />
          <span>{t('settings.denseMode')}</span>
        </label>
        <p className="text-xs text-muted-foreground">{t('settings.denseModeHelp')}</p>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={addToBottomDefault}
            onChange={(e) => setAddToBottomDefault(e.target.checked)}
            className="mt-0.5"
          />
          <span>{t('account.addBottom')}</span>
        </label>
        <p className="text-xs text-muted-foreground">
          {t('account.addBottomHelp')}
        </p>
      </div>
    </div>
  );
}
