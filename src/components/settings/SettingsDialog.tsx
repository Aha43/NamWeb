import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatDate, type DateFormat } from '@/lib/dates';
import { useSettings } from './settings-context';

const SAMPLE_ISO = '2026-06-14';

const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'medium', label: 'Medium' },
  { value: 'iso', label: 'ISO' },
  { value: 'dmy', label: 'Day/Month/Year' },
  { value: 'mdy', label: 'Month/Day/Year' },
];

/** App settings (device-level preferences). Currently the date display format; more land with
 *  the rest of Sprint 7 (keyboard shortcuts, etc.). */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { dateFormat, setDateFormat } = useSettings();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Preferences for this device.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="settings-date-format">Date format</Label>
          <select
            id="settings-date-format"
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value as DateFormat)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
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
      </DialogContent>
    </Dialog>
  );
}
