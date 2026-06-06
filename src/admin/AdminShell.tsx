// Shell comum do /admin: header (linha 1: marca|Sair · linha 2: data|email) e
// barra inferior de abas. Sub-telas (Cadastro, painel de ação) usam onBack.
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { Calendar, LogOut } from '@/components/icons'
import { longDateFromISO } from '@/lib/date'
import logoSerAmor from '@/assets/logo-ser-amor.png'
import { TabBar, type AdminTab } from './ui'
import { DatePicker } from './DatePicker'

interface AdminShellProps {
  /** Mostra um spinner discreto durante o polling (Visão). */
  refreshing?: boolean
  tab?: AdminTab
  onTab?: (t: AdminTab) => void
  /** Mostra "‹ Voltar" e esconde abas/data (sub-telas). */
  onBack?: () => void
  /** Botão Sair (logout do Zero Trust). */
  onLogout?: () => void
  /** Data de referência (ISO `YYYY-MM-DD`) exibida abaixo da marca. */
  dateISO?: string
  /** Habilita o seletor de data (calendário modal). */
  onDateChange?: (iso: string) => void
  children: ReactNode
}

export function AdminShell({
  refreshing,
  tab,
  onTab,
  onBack,
  onLogout,
  dateISO,
  onDateChange,
  children,
}: AdminShellProps) {
  const showTabs = !onBack && tab && onTab
  const [pickerOpen, setPickerOpen] = useState(false)
  const showDate = !!dateISO && !onBack

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-screen flex-col">
      <header className="pt-safe-gap sticky top-0 z-10 border-b border-black/10 bg-white px-4 pb-2">
        {/* Linha 1: marca (ou Voltar) + Sair */}
        <div className="flex items-center justify-between gap-2">
          {onBack ? (
            <button type="button" onClick={onBack} className="text-label text-ink/80 hover:text-ink">
              ‹ Voltar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <img src={logoSerAmor} alt="" className="h-8 w-8 shrink-0" />
              <span className="text-title font-bold text-primary">Base Voluntários</span>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-2">
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

        {/* Linha 2: data de referência (seletor de calendário) — alinhada ao
            texto "Base Voluntários" (indenta pela largura do logo + gap). */}
        {showDate && (
          <div className="mt-1 pl-10">
            {onDateChange ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 text-helper text-muted hover:text-primary"
              >
                <span className="whitespace-nowrap">{longDateFromISO(dateISO)}</span>
                <Calendar size={16} />
              </button>
            ) : (
              <span className="whitespace-nowrap text-helper text-muted">
                {longDateFromISO(dateISO)}
              </span>
            )}
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 py-3">{children}</main>

      {showTabs && <TabBar tab={tab} onTab={onTab} />}

      {pickerOpen && dateISO && onDateChange && (
        <DatePicker
          value={dateISO}
          onSelect={(iso) => {
            onDateChange(iso)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
