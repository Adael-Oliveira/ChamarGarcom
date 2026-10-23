/** Marca da plataforma Chamar Garçom (sino de serviço). */
export default function PlatformMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="platform-mark">
      <rect width="64" height="64" rx="18" fill="currentColor" />
      <path d="M14 44h36" stroke="var(--pm-ink, #fff)" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 40a14 14 0 0 1 28 0z" fill="#FFB020" />
      <circle cx="32" cy="22.5" r="3" fill="#FFB020" />
    </svg>
  );
}
