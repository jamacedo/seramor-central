interface AppHeaderProps {
  /** Mostra "‹ Voltar" à esquerda. */
  onBack?: () => void
  /** Mostra "Usar outro número" à direita. */
  onChangeNumber?: () => void
}

// Header 72px, sem marca, sem linha divisória, branco contínuo.
// Apenas ações de navegação (Voltar / Usar outro número).
export function AppHeader({ onBack, onChangeNumber }: AppHeaderProps) {
  return (
    <header className="pt-safe">
      <div className="flex h-[72px] items-center px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-label text-ink/80 hover:text-ink"
          >
            ‹ Voltar
          </button>
        )}

        {onChangeNumber && (
          <button
            type="button"
            onClick={onChangeNumber}
            className="ml-auto text-label text-primary"
          >
            Trocar número ›
          </button>
        )}
      </div>
    </header>
  )
}
