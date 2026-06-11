import * as React from 'react';
import { cn } from '@/lib/utils';

// Native <label> styled on the design tokens. Kept dependency-light (no
// @radix-ui/react-label) — the `htmlFor`/peer pattern covers our forms.
const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<'label'>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

export { Label };
