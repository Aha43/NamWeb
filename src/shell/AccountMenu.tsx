import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleUser, LogOut, Settings, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';

/** Top-right account menu: the home for account, settings, and sign-out. */
export function AccountMenu({ onSignOut }: { onSignOut: () => void }) {
  const navigate = useNavigate();
  // Who am I — surfaced as the account-icon tooltip (and a header in the menu).
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  return (
    <DropdownMenu>
      <Tooltip label={email ? `Signed in as ${email}` : 'Account'}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account menu">
            <CircleUser className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate('/account')}>
          <User className="mr-2 h-4 w-4" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/account?tab=preferences')}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
