// Raiz do painel /admin (Fase 6). Carrega a identidade do operador (Zero
// Trust) e dirige a navegação por uma pilha sincronizada com o histórico do
// navegador (useAdminNav): botão Voltar do aparelho = "‹ Voltar" do header, e
// recarregar mantém a tela raiz (ex.: Serviço).
import { useCallback, useEffect, useState } from 'react'
import { getIdentity, logout, relogin } from '@/lib/zeroTrust'
import { VisaoScreen } from './VisaoScreen'
import { ServicoScreen } from './ServicoScreen'
import { CadastroScreen } from './CadastroScreen'
import { useAdminNav } from './useAdminNav'
import { useDayData } from './useDayData'
import type { AdminTab } from './ui'
import logoSerAmor from '@/assets/logo-ser-amor.png'

type AuthState = 'checking' | 'authed' | 'denied' | 'offline'

/** Tela cheia centrada (logo + título + mensagem + ação) para bloqueios. */
function StatusScreen({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string
  message: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <img src={logoSerAmor} alt="" className="h-12 w-12" />
      <div>
        <p className="text-title font-bold text-ink">{title}</p>
        <p className="mt-1 text-helper text-muted">{message}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="rounded-lg bg-primary px-5 py-2.5 text-label font-semibold text-white"
      >
        {actionLabel}
      </button>
    </div>
  )
}

export default function AdminApp() {
  const [auth, setAuth] = useState<AuthState>('checking')
  const [operador, setOperador] = useState<string>('')
  // Trava o Voltar no painel autenticado (evita sair para o redirect morto do
  // Access). Em 'denied'/'offline' o Voltar é normal — o usuário pode sair.
  const nav = useAdminNav(auth === 'authed')
  // Store único do dia: Visão e Serviço derivam tudo desta lista (busca 1×/data
  // + polling). Compartilhar aqui mantém os dados ao trocar de aba.
  const day = useDayData(operador, nav.dateISO)

  // Identidade do Zero Trust é gate. 'denied' (edge confirmou sem sessão)
  // bloqueia; 'offline' (não alcançou o edge) NÃO derruba quem já está
  // autenticado — só vira tela de "sem conexão" quando ainda não havia acesso.
  const check = useCallback(() => {
    void getIdentity().then((r) => {
      if (r.status === 'authed') {
        setOperador(r.identity.email)
        setAuth('authed')
      } else if (r.status === 'denied') {
        setOperador('')
        setAuth('denied')
      } else {
        setAuth((prev) => (prev === 'authed' ? 'authed' : 'offline'))
      }
    })
  }, [])

  useEffect(() => {
    document.title = 'Base Voluntários · Admin'
    check()
    // Revalida ao retomar o app (voltar ao PWA/aba após logout): sem sessão,
    // bloqueia em vez de manter a janela já carregada utilizável.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [check])

  // Trocar de aba pela barra inferior: ir para Serviço pela aba abre SEM
  // filtro de área ("Todas"); só o clique numa área da Visão pré-filtra.
  function handleTab(t: AdminTab) {
    nav.replaceRoot(t === 'visao' ? { kind: 'visao' } : { kind: 'servico' })
  }

  if (auth === 'checking') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-muted">
        Verificando acesso…
      </div>
    )
  }

  if (auth === 'denied') {
    return (
      <StatusScreen
        title="Sessão encerrada"
        message="Faça login novamente para acessar o painel."
        actionLabel="Entrar novamente"
        onAction={() => void relogin()}
      />
    )
  }

  if (auth === 'offline') {
    return (
      <StatusScreen
        title="Sem conexão"
        message="Não foi possível verificar seu acesso. Confira a conexão e tente de novo."
        actionLabel="Tentar novamente"
        onAction={check}
      />
    )
  }

  const { current } = nav

  if (current.kind === 'cadastro') {
    return (
      <CadastroScreen
        operador={operador}
        target={current.target}
        // Ao sair do Cadastro, recarrega o dia: telefone editado reflete na lista.
        onClose={() => {
          nav.back()
          day.reload()
        }}
        onLogout={logout}
      />
    )
  }

  if (current.kind === 'visao') {
    return (
      <VisaoScreen
        operador={operador}
        tab="visao"
        onTab={handleTab}
        onLogout={logout}
        dateISO={nav.dateISO}
        onDateChange={nav.setDateISO}
        items={day.items}
        refreshing={day.refreshing}
        onPickArea={(area, turno) => nav.replaceRoot({ kind: 'servico', area, turno })}
      />
    )
  }

  // 'servico' e 'pessoa' renderizam a MESMA ServicoScreen (mantida montada, para
  // não perder busca/scroll da lista ao abrir/fechar o painel da pessoa).
  const servico = nav.servicoRoot ?? { kind: 'servico' as const }
  const selected = current.kind === 'pessoa' ? current.item : null

  return (
    <ServicoScreen
      operador={operador}
      tab="servico"
      onTab={handleTab}
      onLogout={logout}
      dateISO={nav.dateISO}
      onDateChange={nav.setDateISO}
      initialArea={servico.area}
      initialTurno={servico.turno}
      items={day.items}
      refreshing={day.refreshing}
      onPatchPerson={day.patchPerson}
      selected={selected}
      onSelect={(item) => nav.push({ kind: 'pessoa', item })}
      onBackPerson={nav.back}
      onOpenCadastro={(target) => nav.push({ kind: 'cadastro', target })}
    />
  )
}
