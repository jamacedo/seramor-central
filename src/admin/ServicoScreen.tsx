// F6-B · Serviço — Check-in/out manual por nome — US-A1.
// Filtra entre os escalados do dia (store compartilhado) por nome/área/turno NO
// CLIENTE — não refaz busca ao filtrar. Vindo do Dashboard (initialArea), abre
// filtrado. Ao selecionar uma pessoa: dados centralizados + botão fixo na base
// (estilo do check-in do voluntário) + atalho "Atualizar cadastro" (F6-C).
// Check-in/out faz patch local da pessoa (onPatchPerson), sem buscar tudo.
import { useMemo, useState } from 'react'
import { adminCheckin, adminCheckout } from '@/api/adminClient'
import type { AdminPersonState, AdminSearchItem, CadastroTarget } from '@/types/admin'
import { AREAS, type Area, type Turno } from '@/types/api'
import { Button } from '@/components/Button'
import { inferTurno, timeOf } from '@/lib/date'
import { maskPhone } from '@/lib/phone'
import { deburr } from '@/lib/text'
import { AdminShell } from './AdminShell'
import { personKey } from './useDayData'
import { StatusBadge, type AdminTab } from './ui'

const TURNOS: Array<'Todos' | Turno> = ['Todos', 'Manhã', 'Noite']

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
  /** Escalados do dia (store compartilhado); `null` = ainda carregando. */
  items: AdminSearchItem[] | null
  refreshing: boolean
  /** Atualiza UMA pessoa na lista após check-in/out (sem refetch). */
  onPatchPerson: (key: string, next: AdminSearchItem) => void
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
  items,
  refreshing,
  onPatchPerson,
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
  const [acting, setActing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const loading = items === null

  // Filtro NO CLIENTE sobre os dados já buscados do dia. Sem nome (<2 chars)
  // lista todos que batem nos filtros de área/turno.
  const filtered = useMemo(() => {
    const q = deburr(query.trim())
    return (items ?? []).filter(
      (it) =>
        (area === 'Todas' || it.escala.area === area) &&
        (turno === 'Todos' || it.escala.turno === turno) &&
        (q.length < 2 || deburr(it.nome).includes(q)),
    )
  }, [items, query, area, turno])

  async function act(item: AdminSearchItem) {
    setActing(true)
    try {
      const e = {
        telefone: item.escala.telefone,
        data: item.escala.data,
        area: item.escala.area,
        turno: item.escala.turno,
      }
      if (item.estado === 'CAN_CHECKIN') {
        const env = await adminCheckin(operador, e)
        if (env.ok && env.data) {
          // Patch local: só esta pessoa muda de estado (sem refetch do dia).
          onPatchPerson(personKey(item), { ...item, estado: 'IN_SERVICE', checkinAt: env.data.checkinAt })
          setToast(`Check-in de ${item.nome.split(' ')[0]} registrado por você`)
          onBackPerson()
        } else {
          setToast('Não foi possível registrar. Tente de novo.')
        }
      } else {
        const env = await adminCheckout(operador, e)
        if (env.ok && env.data) {
          onPatchPerson(personKey(item), {
            ...item,
            estado: 'DONE',
            checkinAt: env.data.checkinAt ?? item.checkinAt,
            checkoutAt: env.data.checkoutAt,
          })
          setToast(`Check-out de ${item.nome.split(' ')[0]} registrado por você`)
          onBackPerson()
        } else {
          setToast('Não foi possível registrar. Tente de novo.')
        }
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
  const sortedItems = [...filtered].sort((a, b) =>
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
      refreshing={refreshing}
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
          {sortedItems.map((it, i) => (
            // `#i` garante chave única: voluntários SEM telefone colidem em
            // `personKey` (telefone vazio) e, sem o índice, o React não limpa os
            // nós ao trocar o filtro (resultados "acumulados").
            <button
              key={`${personKey(it)}#${i}`}
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
