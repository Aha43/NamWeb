/**
 * Guarantees a ~44px minimum hit area on **touch** devices (coarse pointer) without bloating the
 * compact mouse UI — applied to small icon buttons so they're comfortably tappable on a phone.
 * (44px = the WCAG / platform target-size guidance; `min-*-11` = 2.75rem.)
 */
export const TOUCH_TARGET =
  'inline-flex items-center justify-center [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';
