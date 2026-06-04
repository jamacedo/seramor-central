import type { ReactNode } from 'react'

interface Row {
  icon: ReactNode
  label: ReactNode
}

interface SummaryCardProps {
  title?: string
  rows: Row[]
}

// Card de resumo read-only (T8 sucesso, T4 em serviço). radius 16, sombra sutil.
export function SummaryCard({ title, rows }: SummaryCardProps) {
  return (
    <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
      {title && <p className="mb-3 text-h2 font-bold text-ink">{title}</p>}
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-3 text-body text-ink">
            <span className="shrink-0 text-muted" aria-hidden>
              {r.icon}
            </span>
            <span>{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
