// Calendário modal (centralizado) para escolher a data de referência do /admin.
// Sem dependências externas — grade de mês construída na mão. ISO `YYYY-MM-DD`.
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { todayISO } from '@/lib/date'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

interface DatePickerProps {
  /** Data selecionada (ISO `YYYY-MM-DD`). */
  value: string
  onSelect: (iso: string) => void
  onClose: () => void
}

export function DatePicker({ value, onSelect, onClose }: DatePickerProps) {
  const [vy, vm] = value.split('-').map(Number)
  const [view, setView] = useState({ y: vy, m: vm - 1 }) // m: 0-based

  const firstWeekday = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const todayVal = todayISO()

  const cells: Array<number | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function shift(delta: number) {
    setView(({ y, m }) => {
      const total = y * 12 + m + delta
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Escolher data"
    >
      <div
        className="w-full max-w-[360px] rounded-card bg-white p-4 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navegação de mês */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Mês anterior"
            className="flex h-10 w-10 items-center justify-center rounded-full text-title text-ink hover:bg-black/5"
          >
            ‹
          </button>
          <span className="text-label font-bold text-ink">
            {MONTHS[view.m]} {view.y}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Próximo mês"
            className="flex h-10 w-10 items-center justify-center rounded-full text-title text-ink hover:bg-black/5"
          >
            ›
          </button>
        </div>

        {/* Grade */}
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="py-1 text-[11px] font-medium text-muted">
              {w}
            </span>
          ))}
          {cells.map((d, i) =>
            d === null ? (
              <span key={i} aria-hidden />
            ) : (
              (() => {
                const iso = toISO(view.y, view.m, d)
                const isSel = iso === value
                const isToday = iso === todayVal
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelect(iso)}
                    aria-pressed={isSel}
                    className={cn(
                      'mx-auto flex h-11 w-11 items-center justify-center rounded-full text-label',
                      isSel
                        ? 'bg-primary font-bold text-white'
                        : isToday
                          ? 'text-primary ring-1 ring-primary'
                          : 'text-ink hover:bg-black/5',
                    )}
                  >
                    {d}
                  </button>
                )
              })()
            ),
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-[44px] w-full text-label font-medium text-muted"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
