import { useState } from 'react';

/**
 * Copy text to the clipboard and briefly flag success. The clipboard API can be unavailable
 * (insecure context, denied permission) — failures are swallowed so callers never crash; the
 * underlying text stays selectable for a manual copy.
 */
export function useCopyToClipboard(resetMs = 1500): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);
  function copy(text: string) {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), resetMs);
      })
      .catch(() => {
        // Clipboard unavailable — leave `copied` false; the text remains selectable.
      });
  }
  return { copied, copy };
}
