// F6-A · Visão global (Dashboard) — US-A2.
// Agrega os escalados do dia (vindos do store compartilhado) por área, NO
// CLIENTE — trocar o turno só recomputa, não busca de novo. Tocar num card abre
// Serviço já filtrado pela área (onPickArea).
import { useMemo, useState } from 'react'
import type { AdminSearchItem, AreaStatus, StatusCounts } from '@/types/admin'
import type { Area, Turno } from '@/types/api'
import { inferTurno } from '@/lib/date'
import { AdminShell } from './AdminShell'
import { ProgressBar, pct, type AdminTab } from './ui'

const TURNOS: Array<'Todos' | Turno> = ['Todos', 'Manhã', 'Noite']

function emptyCounts(): StatusCounts {
  return { escalados: 0, pendentes: 0, emServico: 0, concluidos: 0, comparecimento: 0 }
}

const ratio = (c: StatusCounts) =>
  c.escalados === 0 ? 0 : (c.emServico + c.concluidos) / c.escalados

/** Agrega a lista de escalados em resumo + contadores por área (igual ao backend). */
function aggregate(items: AdminSearchItem[]): { resumo: StatusCounts; areas: AreaStatus[] } {
  const byArea = new Map<Area, AreaStatus>()
  const resumo = emptyCounts()
  for (const it of items) {
    const a = byArea.get(it.escala.area) ?? { area: it.escala.area, ...emptyCounts() }
    a.escalados += 1
    resumo.escalados += 1
    if (it.estado === 'IN_SERVICE') {
      a.emServico += 1
      resumo.emServico += 1
    } else if (it.estado === 'DONE') {
      a.concluidos += 1
      resumo.concluidos += 1
    } else {
      a.pendentes += 1
      resumo.pendentes += 1
    }
    byArea.set(it.escala.area, a)
  }
  const areas = [...byArea.values()].map((a) => ({ ...a, comparecimento: ratio(a) }))
  resumo.comparecimento = ratio(resumo)
  return { resumo, areas }
}

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
  /** Escalados do dia (store compartilhado); `null` = ainda carregando. */
  items: AdminSearchItem[] | null
  refreshing: boolean
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
  items,
  refreshing,
  onPickArea,
}: VisaoScreenProps) {
  // Filtro inicial conforme o período do dia (Manhã/Noite).
  const [turno, setTurno] = useState<'Todos' | Turno>(() => inferTurno())
  const [sort, setSort] = useState<SortMode>('pctAsc')

  // Agrega no cliente sobre os dados já buscados — trocar o turno NÃO refaz a
  // busca; só refiltra/recomputa a lista do dia.
  const r = useMemo(() => {
    if (items === null) return null
    const filtered = turno === 'Todos' ? items : items.filter((it) => it.escala.turno === turno)
    return aggregate(filtered)
  }, [items, turno])

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
      <p className="text-lg font-semibold text-ink">
        Olá{operador && operador !== 'desconhecido' ? ` ${operador}` : ''},
      </p>

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
