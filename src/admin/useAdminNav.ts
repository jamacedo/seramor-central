// Navegação do /admin como pilha sincronizada com a History API do navegador.
//
// Dois objetivos:
//  1. Botão Voltar do aparelho = "‹ Voltar" do header (desce um nível em vez de
//     encerrar a página). Cada drill-down empilha uma entrada no histórico; o
//     popstate (aparelho) e o back() (header) passam pela MESMA porta.
//  2. Recarregar a página mantém a tela SÓ quando o usuário está em Serviço:
//     persistimos a raiz `servico` (+ filtros e data) em sessionStorage. Em
//     Visão nada é guardado — o reload volta ao padrão (Visão). Drill-downs
//     (pessoa, cadastro) também não persistem — evita exibir dado defasado.
import { useCallback, useEffect, useRef, useState } from 'react'
import { todayISO } from '@/lib/date'
import type { AdminSearchItem, CadastroTarget } from '@/types/admin'
import type { Area, Turno } from '@/types/api'

export type AdminNav =
  | { kind: 'visao' }
  | { kind: 'servico'; area?: Area; turno?: 'Todos' | Turno }
  | { kind: 'pessoa'; item: AdminSearchItem }
  | { kind: 'cadastro'; target: CadastroTarget }

const KEY = 'admin:nav'

interface Persisted {
  root: AdminNav
  dateISO: string
}

function loadPersisted(): Persisted | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Persisted
    // Só restauramos a raiz Serviço; qualquer outra coisa cai no default (Visão).
    if (p?.root?.kind === 'servico') return p
    return null
  } catch {
    return null
  }
}

export interface AdminNavApi {
  current: AdminNav
  /** Raiz vigente (visao/servico) — base dos filtros da tela de Serviço. */
  servicoRoot?: Extract<AdminNav, { kind: 'servico' }>
  dateISO: string
  setDateISO: (iso: string) => void
  /** Drill-down: empilha tela + entrada no histórico (faz surgir o "‹ Voltar"). */
  push: (node: AdminNav) => void
  /** Troca de raiz (aba/área): tela peer, não empilha histórico. */
  replaceRoot: (node: AdminNav) => void
  /** Voltar um nível — header e aparelho usam esta mesma porta. */
  back: () => void
}

/**
 * @param trapExit Enquanto `true` (painel autenticado), segura uma entrada de
 *   histórico "sentinela": apertar Voltar no nível raiz mantém o usuário no
 *   painel em vez de sair para as entradas (já consumidas) do redirect de login
 *   do Cloudflare Access — revisitar essas entradas dá ERR_FAILED. Em
 *   `false` (verificando/sessão encerrada/sem conexão) o Voltar é normal.
 */
export function useAdminNav(trapExit = false): AdminNavApi {
  const [stack, setStack] = useState<AdminNav[]>(() => {
    const p = loadPersisted()
    return [p?.root ?? { kind: 'visao' }]
  })
  const [dateISO, setDateISO] = useState<string>(() => loadPersisted()?.dateISO ?? todayISO())

  // Profundidade corrente sem recriar o listener de popstate a cada navegação.
  const depthRef = useRef(stack.length)
  useEffect(() => {
    depthRef.current = stack.length
  }, [stack])

  // Persistência: só guardamos quando a raiz é Serviço (refresh mantém Serviço
  // com filtros + data). Em Visão limpamos o registro → reload volta ao padrão.
  useEffect(() => {
    try {
      const root = stack[0]
      if (root.kind === 'servico') {
        sessionStorage.setItem(KEY, JSON.stringify({ root, dateISO }))
      } else {
        sessionStorage.removeItem(KEY)
      }
    } catch {
      /* sessionStorage indisponível: navegação segue só em memória. */
    }
  }, [stack, dateISO])

  // Botão Voltar do aparelho. Em drill-down (profundidade > 1) o navegador já
  // consumiu a entrada empilhada; aqui só descemos um nível na pilha. No nível
  // raiz, se `trapExit`, reentramos a sentinela para NÃO sair do painel para as
  // entradas mortas do redirect do Access (que dão ERR_FAILED ao revisitar).
  useEffect(() => {
    if (trapExit) window.history.pushState({ adminNav: 'root' }, '')

    const onPop = () => {
      if (depthRef.current > 1) {
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
      } else if (trapExit) {
        window.history.pushState({ adminNav: 'root' }, '')
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [trapExit])

  const push = useCallback((node: AdminNav) => {
    setStack((s) => [...s, node])
    window.history.pushState({ adminNav: true }, '')
  }, [])

  const replaceRoot = useCallback((node: AdminNav) => {
    // Abas/área só aparecem na raiz (profundidade 1), onde não há entrada
    // empilhada — trocar a raiz não mexe no histórico.
    setStack([node])
  }, [])

  const back = useCallback(() => {
    // Funil único: dispara o popstate acima, que desce um nível.
    window.history.back()
  }, [])

  const current = stack[stack.length - 1]
  const servicoRoot = stack.find((n): n is Extract<AdminNav, { kind: 'servico' }> => n.kind === 'servico')

  return { current, servicoRoot, dateISO, setDateISO, push, replaceRoot, back }
}
