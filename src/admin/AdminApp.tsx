// Raiz do painel /admin (Fase 6). Carrega a identidade do operador (Zero
// Trust), controla as abas (Visão/Serviço) e o overlay de Cadastro (F6-C).
import { useEffect, useState } from 'react'
import { getIdentity, logout } from '@/lib/zeroTrust'
import type { CadastroTarget } from '@/types/admin'
import type { Area, Turno } from '@/types/api'
import { VisaoScreen } from './VisaoScreen'
import { ServicoScreen } from './ServicoScreen'
import { CadastroScreen } from './CadastroScreen'
import type { AdminTab } from './ui'

export default function AdminApp() {
  const [operador, setOperador] = useState<string>('')
  const [tab, setTab] = useState<AdminTab>('visao')
  const [servicoArea, setServicoArea] = useState<Area | undefined>()
  const [servicoTurno, setServicoTurno] = useState<'Todos' | Turno | undefined>()
  const [cadastro, setCadastro] = useState<CadastroTarget | null>(null)

  useEffect(() => {
    document.title = 'Base Voluntários · Admin'
    void getIdentity().then((id) => setOperador(id.email))
  }, [])

  // Trocar de aba pela barra inferior: ir para Serviço pela aba abre SEM
  // filtro de área ("Todas"); só o clique numa área da Visão pré-filtra.
  function handleTab(t: AdminTab) {
    if (t === 'servico') {
      setServicoArea(undefined)
      setServicoTurno(undefined)
    }
    setTab(t)
  }

  if (!operador) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-muted">
        Verificando acesso…
      </div>
    )
  }

  if (cadastro) {
    return (
      <CadastroScreen
        identity={operador}
        operador={operador}
        target={cadastro}
        onClose={() => setCadastro(null)}
        onLogout={logout}
      />
    )
  }

  if (tab === 'visao') {
    return (
      <VisaoScreen
        identity={operador}
        operador={operador}
        tab={tab}
        onTab={handleTab}
        onLogout={logout}
        onPickArea={(area, turno) => {
          setServicoArea(area)
          setServicoTurno(turno)
          setTab('servico')
        }}
      />
    )
  }

  return (
    <ServicoScreen
      identity={operador}
      operador={operador}
      tab={tab}
      onTab={handleTab}
      onLogout={logout}
      initialArea={servicoArea}
      initialTurno={servicoTurno}
      onOpenCadastro={(target) => setCadastro(target)}
    />
  )
}
