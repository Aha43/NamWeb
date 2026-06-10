import { DesktopShell } from './shell/DesktopShell';
import { PhoneShell } from './shell/PhoneShell';
import { useIsDesktop } from './shell/useIsDesktop';

/**
 * Form-factor switch. The split is architectural, not cosmetic: the laptop shell
 * trends toward NamDesktop parity (sidebar, all surfaces), while the phone shell
 * pushes capture + execution to the front and tucks the rest behind a menu.
 */
export function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopShell onSignOut={onSignOut} /> : <PhoneShell onSignOut={onSignOut} />;
}
