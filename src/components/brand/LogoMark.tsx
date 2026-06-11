// NamWeb brand mark — ported from NamDesktop `src/icons/logo-mark.svg`.
// Inlined as JSX (rather than an <img>) so the structural nodes/links follow
// `currentColor` and stay legible on both themes; the green signal node and its
// white check are fixed brand colours. Size and colour come from `className`
// (e.g. `h-12 w-12 text-card-foreground`).

import { APP_NAME } from '@/lib/app';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="none"
      role="img"
      aria-label={APP_NAME}
      className={className}
    >
      <title>{APP_NAME}</title>
      <g stroke="currentColor" strokeWidth={11} strokeLinecap="round" opacity={0.42}>
        <path d="M128 74 L84 182" />
        <path d="M128 74 L172 182" />
      </g>
      {/* signal arcs: NAM is live and in the conversation */}
      <g fill="none" stroke="#3FA463" strokeWidth={7} strokeLinecap="round">
        <path d="M130.6 44.1 A30 30 0 0 1 157.5 68.8" opacity={0.55} />
        <path d="M131.7 32.2 A42 42 0 0 1 169.4 66.7" opacity={0.3} />
      </g>
      <circle cx={128} cy={74} r={18} fill="currentColor" />
      <circle cx={84} cy={182} r={18} fill="currentColor" />
      <circle cx={172} cy={182} r={27} fill="#3FA463" />
      <path
        d="M159 183 l9 9 l18 -21"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
