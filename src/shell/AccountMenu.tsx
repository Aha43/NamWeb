import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleUser, HelpCircle, LogOut, Settings, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { DemoContext } from '@/demo/demo-context';

/** Top-right account menu: the home for account, settings, and sign-out. In the no-account demo it
 *  hides the account surfaces (there's no real account) and turns sign-out into the sign-up CTA. */
export function AccountMenu({
  onSignOut,
  onOpenSettings,
}: {
  onSignOut: () => void;
  /** Desktop: open Account/Preferences in the right settings panel (#599) instead of navigating
   *  to the full page. Absent → navigate (the full page remains for phone + direct links). */
  onOpenSettings?: (tab: 'account' | 'preferences') => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const demo = useContext(DemoContext);
  // Who am I — surfaced as the account-icon tooltip (and a header in the menu).
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (demo) return; // no real session in demo
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [demo]);
  return (
    <DropdownMenu>
      <Tooltip label={demo ? t('accountMenu.demo') : email ? t('accountMenu.signedInAs', { email }) : t('nav.account')}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('accountMenu.menuAria')}>
            <CircleUser className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        {!demo && (
          <DropdownMenuItem onClick={() => (onOpenSettings ? onOpenSettings('account') : navigate('/account'))}>
            <User className="mr-2 h-4 w-4" />
            {t('nav.account')}
          </DropdownMenuItem>
        )}
        {!demo && (
          <DropdownMenuItem
            onClick={() => (onOpenSettings ? onOpenSettings('preferences') : navigate('/account?tab=preferences'))}
          >
            <Settings className="mr-2 h-4 w-4" />
            {t('nav.settings')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate('/help')}>
          <HelpCircle className="mr-2 h-4 w-4" />
          {t('nav.help')}
          <kbd className="ml-auto rounded border border-border bg-muted px-1 text-[10px] text-muted-foreground">?</kbd>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={demo ? demo.signUp : onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {demo ? t('accountMenu.signUp') : t('nav.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
