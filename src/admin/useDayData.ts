// Store dos dados do dia (escalados) compartilhado por Visão e Serviço.
//
// Faz UMA busca por data (adminSearch sem filtros = todos os escalados do dia) e
// mantém a lista em memória. A partir dela:
//  - Visão agrega os contadores por área NO CLIENTE (trocar turno = recomputar);
//  - Serviço filtra por nome/área/turno NO CLIENTE (sem refetch);
//  - trocar de aba Visão↔Serviço reusa a mesma lista (mesmo store no AdminApp);
//  - check-in/out fazem patch local da pessoa (sem buscar tudo de novo).
// Polling leve (25s) mantém a lista fresca; trocar a DATA é o único gatilho de
// nova busca (além do poll).
import { useCallback, useEffect, useRef, useState } from 'react'
import { adminSearch } from '@/api/adminClient'
import type { AdminSearchItem } from '@/types/admin'
import { isoToBR } from '@/lib/date'

const POLL_MS = 25000

/**
 * Chave única da linha de escala. Prefere `ref` (nº da linha) — estável mesmo
 * sem telefone e quando o telefone é editado; cai na tripla telefone+área+turno
 * só se `ref` não vier. (Telefone vazio colide, daí o ref.)
 */
export function personKey(it: AdminSearchItem): string {
  return it.ref != null ? `r${it.ref}` : `${it.telefone}-${it.escala.area}-${it.escala.turno}`
}

export interface DayData {
  /** Escalados do dia; `null` enquanto a primeira busca não voltou. */
  items: AdminSearchItem[] | null
  refreshing: boolean
  /** Força uma nova busca (ex.: após editar telefone). */
  reload: () => void
  /** Substitui uma pessoa na lista, sem refetch (após check-in/out). */
  patchPerson: (key: string, next: AdminSearchItem) => void
}

export function useDayData(operador: string, dateISO: string): DayData {
  const [items, setItems] = useState<AdminSearchItem[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const reqId = useRef(0)
  const dataBR = isoToBR(dateISO)

  const reload = useCallback(async () => {
    if (!operador) return
    const id = ++reqId.current
    setRefreshing(true)
    try {
      const env = await adminSearch(operador, '', { data: dataBR })
      if (id === reqId.current && env.ok && env.data) setItems(env.data.itens)
    } catch {
      // mantém o último resultado
    } finally {
      if (id === reqId.current) setRefreshing(false)
    }
  }, [operador, dataBR])

  // Nova data/operador → limpa (mostra carregando) e busca; depois faz polling
  // (pausado quando a aba está em background).
  useEffect(() => {
    setItems(null)
    void reload()
    const t = setInterval(() => {
      if (!document.hidden) void reload()
    }, POLL_MS)
    return () => clearInterval(t)
  }, [reload])

  const patchPerson = useCallback((key: string, next: AdminSearchItem) => {
    // Invalida buscas em voo para o patch local não ser sobrescrito por um poll
    // que partiu antes da ação.
    reqId.current++
    setRefreshing(false)
    setItems((cur) => (cur ? cur.map((it) => (personKey(it) === key ? next : it)) : cur))
  }, [])

  return { items, refreshing, reload, patchPerson }
}
