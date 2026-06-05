// Shell comum do /admin: header (marca + Sair) e barra inferior de abas.
// Sub-telas (Cadastro, painel de ação) usam onBack + showTabs implícito off.
import type { ReactNode } from 'react'
import { Spinner } from '@/components/Spinner'
import { LogOut } from '@/components/icons'
import logoSerAmor from '@/assets/logo-ser-amor.png'
import { TabBar, type AdminTab } from './ui'

interface AdminShellProps {
  identity: string
  /** Mostra um spinner discreto durante o polling (Visão). */
  refreshing?: boolean
  tab?: AdminTab
  onTab?: (t: AdminTab) => void
  /** Mostra "‹ Voltar" e esconde as abas (sub-telas). */
  onBack?: () => void
  /** Botão Sair (logout do Zero Trust). */
  onLogout?: () => void
  children: ReactNode
}

export function AdminShell({
  identity,
  refreshing,
  tab,
  onTab,
  onBack,
  onLogout,
  children,
}: AdminShellProps) {
  const showTabs = !onBack && tab && onTab
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-screen flex-col">
      <header className="pt-safe sticky top-0 z-10 border-b border-black/10 bg-white px-4">
        <div className="flex h-14 items-center justify-between gap-2">
          {onBack ? (
            <button type="button" onClick={onBack} className="text-label text-ink/80 hover:text-ink">
              ‹ Voltar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <img src={logoSerAmor} alt="" className="h-8 w-8" />
              <span className="text-title font-bold text-primary">Base Voluntários</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            {refreshing && <Spinner size={16} className="text-muted" />}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                aria-label="Sair"
                title="Sair"
                className="-mr-1 p-1 text-muted hover:text-ink"
              >
                <LogOut size={22} />
              </button>
            )}
          </div>
        </div>
        <div className="truncate pb-1 text-helper text-muted">{identity}</div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 py-3">{children}</main>

      {showTabs && <TabBar tab={tab} onTab={onTab} />}
    </div>
  )
}
