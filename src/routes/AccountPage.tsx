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
import { useSettings } from '@/components/settings/settings-context';

const SAMPLE_ISO = '2026-06-14';
const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'medium', label: 'Medium' },
  { value: 'iso', label: 'ISO' },
  { value: 'dmy', label: 'Day/Month/Year' },
  { value: 'mdy', label: 'Month/Day/Year' },
];

type Tab = 'account' | 'preferences';

/** The Settings/Account home: identity/security on the Account tab, device preferences on Preferences. */
export function AccountPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'preferences' ? 'preferences' : 'account';
  const setTab = (next: Tab) =>
    setParams(next === 'account' ? {} : { tab: next }, { replace: true });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <div role="tablist" className="mt-4 flex gap-1 border-b border-border">
        {(['account', 'preferences'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">{tab === 'account' ? <AccountTab /> : <PreferencesTab />}</div>
    </div>
  );
}

function AccountTab() {
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
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Label>Email</Label>
        <p className="text-sm text-foreground">{email ?? '…'}</p>
      </div>

      <div className="space-y-1.5">
        <Button variant="secondary" onClick={onExport} disabled={exporting} className="gap-2">
          <Download className="h-4 w-4" />
          {exporting ? 'Preparing…' : 'Export my data'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Download a JSON copy of all your workspaces.
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
        Sign out
      </Button>

      <DeleteAccount />
    </div>
  );
}

function InviteFriend() {
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
      <p className="text-sm font-medium text-foreground">Invite a friend</p>
      <Button variant="secondary" onClick={copy} className="gap-2">
        {copied ? <Copy className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {copied ? 'Link copied!' : 'Copy invite link'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Share this link to invite someone to Nam — it opens straight to sign-up.
      </p>
    </div>
  );
}

function DeleteAccount() {
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
      <p className="text-sm font-medium text-destructive">Danger zone</p>
      <p className="text-xs text-muted-foreground">
        Permanently delete your account and all your cloud data. This can't be undone.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)} className="gap-2">
        <Trash2 className="h-4 w-4" />
        Delete account
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
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your account and all your workspaces from the cloud — on the web
              and any synced device. Local desktop files on your own machine are not affected. This
              can't be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button variant="outline" onClick={exportFirst} className="gap-2">
              <Download className="h-4 w-4" />
              Export my data first
            </Button>
            <div>
              <Label htmlFor="confirm-delete" className="text-xs text-muted-foreground">
                Type DELETE to confirm
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
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={busy || confirmText !== 'DELETE'}
              onClick={onDelete}
            >
              {busy ? 'Deleting…' : 'Delete account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChangePassword() {
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
      <p className="text-sm font-medium text-foreground">Change password</p>
      <div>
        <Label htmlFor="new-password" className="text-xs text-muted-foreground">
          New password
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
          Confirm new password
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
        {busy ? 'Saving…' : 'Update password'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {done && <p className="text-sm text-muted-foreground">Password updated.</p>}
    </form>
  );
}

function PreferencesTab() {
  const { dateFormat, setDateFormat, addToBottomDefault, setAddToBottomDefault } = useSettings();
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="settings-date-format">Date format</Label>
        <select
          id="settings-date-format"
          value={dateFormat}
          onChange={(e) => setDateFormat(e.target.value as DateFormat)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
        >
          {DATE_FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} — {formatDate(SAMPLE_ISO, opt.value)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          How due dates are displayed. Date entry is unaffected.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={addToBottomDefault}
            onChange={(e) => setAddToBottomDefault(e.target.checked)}
            className="mt-0.5"
          />
          <span>New items go to the bottom by default</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Your default position for new actions, projects, and inbox captures (off = top). You can flip
          it just for now with the top/bottom toggle beside each add box; that resets to this default.
        </p>
      </div>
    </div>
  );
}
