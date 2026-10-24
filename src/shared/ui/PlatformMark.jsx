import { useId } from 'react';

/** Marca da plataforma Acenai (mão acenando + sinal). */
export default function PlatformMark({ size = 32 }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="platform-mark">
      <defs>
        <linearGradient id={`pm${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc21a" />
          <stop offset="1" stopColor="#ff8a00" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="currentColor" />
      <g fill="none" stroke={`url(#pm${id})`} strokeLinecap="round" strokeWidth="4.6" transform="translate(1.5 1)">
        <path d="M12.5 31 L12.5 38 A11.5 11.5 0 0 0 33.5 44 L38 36.5" />
        <path d="M19 33 L24.5 21.5" />
        <path d="M25.5 36 L31 25" />
        <path d="M32 38.5 L36.5 30" />
        <path d="M40 16.5 A9 9 0 0 1 47.5 25" strokeWidth="4" />
        <path d="M43 8.5 A17 17 0 0 1 56 22" strokeWidth="4" />
      </g>
    </svg>
  );
}

/** Nome da plataforma com o "ai" em destaque. */
export function Wordmark() {
  return (
    <span className="wordmark">
      Acen<b>ai</b>
    </span>
  );
}
