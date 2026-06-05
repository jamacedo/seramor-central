// Ícones inline (sem dependência externa — mantém o bundle leve).

interface IconProps {
  size?: number
  className?: string
}

export function CheckCircle({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AlertTriangle({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3l9.5 16.5H2.5L12 3z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17.2" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function Ban({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.6 5.6l12.8 12.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function WifiOff({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3 4l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M5 9a14 14 0 0 1 4-2.3M12 5c3 0 5.8 1.1 7.9 3M8.5 12.2A8 8 0 0 1 12 11M16 13a6 6 0 0 0-1.6-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1.4" fill="currentColor" />
    </svg>
  )
}

// ── Ícones do painel /admin (Fase 6) ───────────────────────────────

/** Grade — aba Visão. */
export function Grid({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

/** Pessoa com check — aba Serviço (check-in/out por nome). */
export function UserCheck({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="7.5" r="3.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M15.5 12.8l2 2 3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Sair — logout (Zero Trust). */
export function LogOut({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 16l4-4-4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
