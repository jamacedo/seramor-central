// F6-A · Visão global (Dashboard) — US-A2.
// Status de todas as áreas, com polling leve. Tocar num card abre Serviço
// já filtrado pela área (onPickArea).
import { useCallback, useEffect, useState } from 'react'
import { adminDashboard } from '@/api/adminClient'
import type { AdminDashboardResult } from '@/types/admin'
import type { Area, Turno } from '@/types/api'
import { inferTurno, isoToBR } from '@/lib/date'
import { AdminShell } from './AdminShell'
import { ProgressBar, pct, type AdminTab } from './ui'

const POLL_MS = 25000
const TURNOS: Array<'Todos' | Turno> = ['Todos', 'Manhã', 'Noite']

type SortMode = 'pctAsc' | 'pctDesc' | 'nome'
const SORT_LABEL: Record<SortMode, string> = {
  pctAsc: 'Menor % primeiro',
  pctDesc: 'Maior % primeiro',
  nome: 'Nome (A–Z)',
}

interface VisaoScreenProps {
  operador: string
  tab: AdminTab
  onTab: (t: AdminTab) => void
  onLogout: () => void
  /** Data de referência (ISO) + handler de troca, exibidos no header. */
  dateISO: string
  onDateChange: (iso: string) => void
  /** Abre Serviço filtrado pela área, carregando o turno atual do Dashboard. */
  onPickArea: (area: Area, turno: 'Todos' | Turno) => void
}

export function VisaoScreen({
  operador,
  tab,
  onTab,
  onLogout,
  dateISO,
  onDateChange,
  onPickArea,
}: VisaoScreenProps) {
  // Filtro inicial conforme o período do dia (Manhã/Noite).
  const [turno, setTurno] = useState<'Todos' | Turno>(() => inferTurno())
  const [sort, setSort] = useState<SortMode>('pctAsc')
  const [result, setResult] = useState<AdminDashboardResult | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const env = await adminDashboard(operador, {
        turno: turno === 'Todos' ? undefined : turno,
        data: isoToBR(dateISO),
      })
      if (env.ok && env.data) setResult(env.data)
    } catch {
      // mantém o último resultado
    } finally {
      setRefreshing(false)
    }
  }, [operador, turno, dateISO])

  useEffect(() => {
    let active = true
    void load()
    const id = setInterval(() => {
      if (!document.hidden && active) void load()
    }, POLL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [load])

  const r = result
  const sortedAreas = r
    ? [...r.areas].sort((a, b) =>
        sort === 'nome'
          ? a.area.localeCompare(b.area, 'pt')
          : sort === 'pctDesc'
            ? b.comparecimento - a.comparecimento
            : a.comparecimento - b.comparecimento,
      )
    : []

  return (
    <AdminShell
      tab={tab}
      onTab={onTab}
      onLogout={onLogout}
      refreshing={refreshing}
      dateISO={dateISO}
      onDateChange={onDateChange}
    >
      <p className="text-lg font-semibold text-ink">Olá {operador},</p>

      <div className="flex items-center gap-2">
        <span className="text-label font-semibold text-ink">Turno</span>
        <select
          value={turno}
          onChange={(e) => setTurno(e.target.value as 'Todos' | Turno)}
          className="rounded-input border border-black/10 px-2 py-1 text-label"
        >
          {TURNOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {!r ? (
        <p className="py-8 text-center text-muted">⟳ Carregando áreas…</p>
      ) : r.areas.length === 0 ? (
        <p className="py-8 text-center text-muted">Nenhuma escala para este turno.</p>
      ) : (
        <>
          {/* Resumo agregado */}
          <section className="rounded-card bg-white p-4 shadow-card">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-h2 text-ink">{r.resumo.escalados}</span>{' '}
                <span className="text-helper text-muted">escalados</span>
              </div>
              <span className="text-title font-bold text-primary">{pct(r.resumo.comparecimento)}</span>
            </div>
            <div className="mt-2">
              <ProgressBar value={r.resumo.comparecimento} />
            </div>
            <div className="mt-2 flex gap-4 text-helper text-muted">
              <span>⏳ {r.resumo.pendentes}</span>
              <span>🟡 {r.resumo.emServico}</span>
              <span>✅ {r.resumo.concluidos}</span>
            </div>
          </section>

          {/* Cards por área — ordenação controlada pelo usuário */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-helper font-semibold text-ink">ÁREAS</span>
            <label className="flex items-center gap-1 text-helper text-muted">
              <span className="sr-only">Ordenar áreas</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="rounded-input border border-black/10 px-2 py-1 text-helper text-ink"
              >
                {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
                  <option key={m} value={m}>
                    {SORT_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-col gap-2">
            {sortedAreas.map((a) => {
              const presentes = a.emServico + a.concluidos
              return (
                <button
                  key={a.area}
                  type="button"
                  onClick={() => onPickArea(a.area, turno)}
                  className="rounded-card bg-white p-3 text-left shadow-card active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-label font-bold text-ink">{a.area}</span>
                    <span className="text-helper text-muted">
                      {presentes}/{a.escalados} · {pct(a.comparecimento)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={a.comparecimento} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-helper text-muted">
                    <span>
                      ⏳ {a.pendentes}&nbsp;&nbsp;🟡 {a.emServico}&nbsp;&nbsp;✅ {a.concluidos}
                    </span>
                    <span aria-hidden className="text-primary">
                      ▸
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </AdminShell>
  )
}
