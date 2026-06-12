// F6-B · Serviço — Check-in/out manual por nome — US-A1.
// Busca entre os escalados de HOJE. Sem nome e com "Todas as áreas", lista
// todos do turno corrente. Vindo do Dashboard (initialArea), abre filtrado.
// Ao selecionar uma pessoa: dados centralizados + botão fixo na base
// (estilo do check-in do voluntário) + atalho "Atualizar cadastro" (F6-C).
import { useEffect, useRef, useState } from 'react'
import { adminCheckin, adminCheckout, adminSearch } from '@/api/adminClient'
import type { AdminPersonState, AdminSearchItem, CadastroTarget } from '@/types/admin'
import { AREAS, type Area, type Turno } from '@/types/api'
import { Button } from '@/components/Button'
import { inferTurno, isoToBR, timeOf } from '@/lib/date'
import { maskPhone } from '@/lib/phone'
import { AdminShell } from './AdminShell'
import { StatusBadge, type AdminTab } from './ui'

const TURNOS: Array<'Todos' | Turno> = ['Todos', 'Manhã', 'Noite']
const DEBOUNCE_MS = 300

type ServicoSort = 'status' | 'nome' | 'area'
const SORT_LABEL: Record<ServicoSort, string> = {
  status: 'Status',
  nome: 'Alfabética (Nome)',
  area: 'Alfabética (Área)',
}
// Foco operacional: pendentes primeiro, depois em serviço, por fim concluídos.
const STATUS_RANK: Record<AdminPersonState, number> = { CAN_CHECKIN: 0, IN_SERVICE: 1, DONE: 2 }

interface ServicoScreenProps {
  operador: string
  tab: AdminTab
  onTab: (t: AdminTab) => void
  onLogout: () => void
  /** Data de referência (ISO) + handler de troca, exibidos no header. */
  dateISO: string
  onDateChange: (iso: string) => void
  /** Pré-filtros quando aberto a partir do Dashboard (F6-A). */
  initialArea?: Area
  initialTurno?: 'Todos' | Turno
  /** Pessoa em foco (painel de ação) — vem da pilha de navegação do AdminApp. */
  selected: AdminSearchItem | null
  /** Abrir o painel de uma pessoa (drill-down na pilha). */
  onSelect: (item: AdminSearchItem) => void
  /** Voltar do painel para a lista (= "‹ Voltar" / botão do aparelho). */
  onBackPerson: () => void
  onOpenCadastro: (target: CadastroTarget) => void
}

export function ServicoScreen({
  operador,
  tab,
  onTab,
  onLogout,
  dateISO,
  onDateChange,
  initialArea,
  initialTurno,
  selected,
  onSelect,
  onBackPerson,
  onOpenCadastro,
}: ServicoScreenProps) {
  const [query, setQuery] = useState('')
  const [area, setArea] = useState<'Todas' | Area>(initialArea ?? 'Todas')
  // Vindo do Dashboard, herda o turno de lá; senão, infere pelo período do dia.
  const [turno, setTurno] = useState<'Todos' | Turno>(() => initialTurno ?? inferTurno())
  const [sort, setSort] = useState<ServicoSort>('status')
  const [items, setItems] = useState<AdminSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const reqId = useRef(0)

  // Busca com debounce. Sem nome lista todos os escalados dos filtros atuais.
  useEffect(() => {
    if (selected) return
    const filters = {
      area: area === 'Todas' ? undefined : area,
      turno: turno === 'Todos' ? undefined : turno,
      data: isoToBR(dateISO),
    }
    const id = ++reqId.current
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const env = await adminSearch(operador, query.trim(), filters)
        if (id === reqId.current && env.ok && env.data) setItems(env.data.itens)
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [operador, query, area, turno, dateISO, selected])

  async function act(item: AdminSearchItem) {
    setActing(true)
    try {
      const e = {
        telefone: item.escala.telefone,
        data: item.escala.data,
        area: item.escala.area,
        turno: item.escala.turno,
      }
      const env =
        item.estado === 'CAN_CHECKIN'
          ? await adminCheckin(operador, e)
          : await adminCheckout(operador, e)
      if (env.ok && env.data) {
        const verb = item.estado === 'CAN_CHECKIN' ? 'Check-in' : 'Check-out'
        setToast(`${verb} de ${item.nome.split(' ')[0]} registrado por você`)
        onBackPerson() // volta à lista; o efeito re-busca e atualiza o selo
      } else {
        setToast('Não foi possível registrar. Tente de novo.')
      }
    } catch {
      setToast('Falha de conexão. Tente de novo.')
    } finally {
      setActing(false)
    }
  }

  // ── Painel de ação (pessoa selecionada) ──────────────────────────
  if (selected) {
    const s = selected
    return (
      <AdminShell onBack={onBackPerson} onLogout={onLogout}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div>
            <h2 className="text-h2 text-ink">{s.nome}</h2>
            <p className="text-label text-muted">
              {s.escala.area} · {s.escala.turno} · {s.escala.funcao}
            </p>
          </div>

          <StatusBadge estado={s.estado} />

          {s.estado === 'IN_SERVICE' && (
            <p className="text-helper text-muted">Entrou às {timeOf(s.checkinAt)}</p>
          )}
          {s.estado === 'DONE' && (
            <p className="text-label text-ink">
              {timeOf(s.checkinAt)} → {timeOf(s.checkoutAt)}
            </p>
          )}

          <p className="text-label text-ink">📞 {maskPhone(s.telefone) || '—'}</p>
        </div>

        {/* Ações fixas na base (estilo check-in do voluntário) */}
        <div className="flex flex-col gap-2 pb-safe pt-3">
          {s.estado === 'CAN_CHECKIN' && (
            <Button variant="checkin" loading={acting} onClick={() => act(s)}>
              Confirmar Check-in
            </Button>
          )}
          {s.estado === 'IN_SERVICE' && (
            <Button variant="checkout" loading={acting} onClick={() => act(s)}>
              Confirmar Check-out
            </Button>
          )}
          <button
            type="button"
            onClick={() => onOpenCadastro({ nome: s.nome, area: s.escala.area, telefone: s.telefone })}
            className="min-h-[44px] text-label font-medium text-primary"
          >
            ✎ Atualizar cadastro
          </button>
        </div>
      </AdminShell>
    )
  }

  // ── Lista (busca / filtro) ───────────────────────────────────────
  const sortedItems = [...items].sort((a, b) =>
    sort === 'nome'
      ? a.nome.localeCompare(b.nome, 'pt')
      : sort === 'area'
        ? a.escala.area.localeCompare(b.escala.area, 'pt') || a.nome.localeCompare(b.nome, 'pt')
        : STATUS_RANK[a.estado] - STATUS_RANK[b.estado] || a.nome.localeCompare(b.nome, 'pt'),
  )

  return (
    <AdminShell
      tab={tab}
      onTab={onTab}
      onLogout={onLogout}
      dateISO={dateISO}
      onDateChange={onDateChange}
    >
      {toast && (
        <div className="rounded-input bg-success/10 px-3 py-2 text-helper text-success">{toast}</div>
      )}

      <label className="text-label font-semibold text-ink" htmlFor="busca">
        Voluntários escalados
      </label>
      <input
        id="busca"
        value={query}
        onChange={(e) => {
          setToast(null)
          setQuery(e.target.value)
        }}
        placeholder="🔍 Nome do voluntário"
        className="rounded-input border border-black/10 px-3 py-2.5 text-label"
      />

      <div className="flex gap-2">
        <select
          value={area}
          onChange={(e) => setArea(e.target.value as 'Todas' | Area)}
          className="flex-1 rounded-input border border-black/10 px-2 py-2 text-label"
        >
          <option value="Todas">Todas as áreas</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={turno}
          onChange={(e) => setTurno(e.target.value as 'Todos' | Turno)}
          className="rounded-input border border-black/10 px-2 py-2 text-label"
        >
          {TURNOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-6 text-center text-muted">⟳ Buscando…</p>
      ) : sortedItems.length === 0 ? (
        <p className="py-6 text-center text-muted">Ninguém escalado hoje bate com o filtro.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-helper text-muted">{sortedItems.length} resultado(s)</span>
            <label className="flex items-center gap-1 text-helper text-muted">
              <span className="sr-only">Ordenar</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as ServicoSort)}
                className="rounded-input border border-black/10 px-2 py-1 text-helper text-ink"
              >
                {(Object.keys(SORT_LABEL) as ServicoSort[]).map((m) => (
                  <option key={m} value={m}>
                    {SORT_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {sortedItems.map((it) => (
            <button
              key={`${it.telefone}-${it.escala.area}-${it.escala.turno}`}
              type="button"
              onClick={() => onSelect(it)}
              className="rounded-card bg-white p-3 text-left shadow-card active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <span className="text-label font-bold text-ink">{it.nome}</span>
                <StatusBadge estado={it.estado} />
              </div>
              <p className="text-helper text-muted">
                {it.escala.area} · {it.escala.turno} · {it.escala.funcao}
              </p>
            </button>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
