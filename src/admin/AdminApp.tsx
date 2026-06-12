// Raiz do painel /admin (Fase 6). Carrega a identidade do operador (Zero
// Trust) e dirige a navegação por uma pilha sincronizada com o histórico do
// navegador (useAdminNav): botão Voltar do aparelho = "‹ Voltar" do header, e
// recarregar mantém a tela raiz (ex.: Serviço).
import { useEffect, useState } from 'react'
import { getIdentity, logout } from '@/lib/zeroTrust'
import { VisaoScreen } from './VisaoScreen'
import { ServicoScreen } from './ServicoScreen'
import { CadastroScreen } from './CadastroScreen'
import { useAdminNav } from './useAdminNav'
import { useDayData } from './useDayData'
import type { AdminTab } from './ui'

export default function AdminApp() {
  const [operador, setOperador] = useState<string>('')
  const nav = useAdminNav()
  // Store único do dia: Visão e Serviço derivam tudo desta lista (busca 1×/data
  // + polling). Compartilhar aqui mantém os dados ao trocar de aba.
  const day = useDayData(operador, nav.dateISO)

  useEffect(() => {
    document.title = 'Base Voluntários · Admin'
    void getIdentity().then((id) => setOperador(id.email))
  }, [])

  // Trocar de aba pela barra inferior: ir para Serviço pela aba abre SEM
  // filtro de área ("Todas"); só o clique numa área da Visão pré-filtra.
  function handleTab(t: AdminTab) {
    nav.replaceRoot(t === 'visao' ? { kind: 'visao' } : { kind: 'servico' })
  }

  if (!operador) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-muted">
        Verificando acesso…
      </div>
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
