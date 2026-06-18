import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useTheme } from './theme-context';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Tooltip label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
        {theme === 'dark' ? <Sun /> : <Moon />}
      </Button>
    </Tooltip>
  );
}
