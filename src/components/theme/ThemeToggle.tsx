import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useTheme } from './theme-context';

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  return (
    <Tooltip label={theme === 'dark' ? t('theme.switchLight') : t('theme.switchDark')}>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('theme.toggle')}>
        {theme === 'dark' ? <Sun /> : <Moon />}
      </Button>
    </Tooltip>
  );
}
