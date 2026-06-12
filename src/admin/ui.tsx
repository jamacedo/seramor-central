// Peças visuais compartilhadas do painel /admin (Fase 6).
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Grid, UserCheck } from '@/components/icons'
import type { AdminPersonState } from '@/types/admin'

export type AdminTab = 'visao' | 'servico'

const STATUS: Record<AdminPersonState, { dot: string; label: string; cls: string }> = {
  CAN_CHECKIN: { dot: '⏳', label: 'Pendente', cls: 'text-muted' },
  IN_SERVICE: { dot: '🟡', label: 'Em serviço', cls: 'text-warning' },
  DONE: { dot: '✅', label: 'Concluído', cls: 'text-success' },
}

/** Selo de status derivado das flags In/Out (doc §4 — legenda). */
export function StatusBadge({ estado, className }: { estado: AdminPersonState; className?: string }) {
  const s = STATUS[estado]
  return (
    <span className={cn('inline-flex items-center gap-1 text-helper font-medium', s.cls, className)}>
      <span aria-hidden>{s.dot}</span>
      {s.label}
    </span>
  )
}

/** Barra de progresso de comparecimento (0..1). */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
      <div className="h-full rounded-full bg-checkin" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Barra inferior de navegação — Visão · Serviço (com ícones). */
export function TabBar({ tab, onTab }: { tab: AdminTab; onTab: (t: AdminTab) => void }) {
  const item = (key: AdminTab, label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => onTab(key)}
      aria-current={tab === key}
      className={cn(
        'flex flex-1 flex-col items-center gap-1 py-2 text-helper font-semibold transition-colors',
        tab === key ? 'text-primary' : 'text-muted',
      )}
    >
      {icon}
      {label}
    </button>
  )
  return (
    <nav className="sticky bottom-0 flex border-t border-black/10 bg-white pb-safe">
      {item('visao', 'Visão', <Grid size={22} />)}
      {item('servico', 'Serviço', <UserCheck size={22} />)}
    </nav>
  )
}

/** Formata 0..1 como inteiro de porcentagem. */
export function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}
