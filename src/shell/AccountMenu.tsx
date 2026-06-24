import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
export function AccountMenu({ onSignOut }: { onSignOut: () => void }) {
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
      <Tooltip label={demo ? 'Demo' : email ? `Signed in as ${email}` : 'Account'}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account menu">
            <CircleUser className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        {!demo && (
          <DropdownMenuItem onClick={() => navigate('/account')}>
            <User className="mr-2 h-4 w-4" />
            Account
          </DropdownMenuItem>
        )}
        {!demo && (
          <DropdownMenuItem onClick={() => navigate('/account?tab=preferences')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate('/help')}>
          <HelpCircle className="mr-2 h-4 w-4" />
          Help
        </DropdownMenuItem>
        <DropdownMenuItem onClick={demo ? demo.signUp : onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {demo ? 'Sign up to keep your work' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
