import { AppHeader } from '@/components/AppHeader'
import { Screen } from '@/components/Screen'
import type { OpcaoMultipla, ResolveMultiple } from '@/types/api'

interface MultipleScreenProps {
  data: ResolveMultiple
  onSelect: (nome: string, opcao: OpcaoMultipla) => void
  onChangeNumber: () => void
}

// Selo de status quando a linha já tem check-in/out (Wireframes T6).
function statusSelo(estado: OpcaoMultipla['estado']) {
  if (estado === 'IN_SERVICE') return { text: 'Em serviço', className: 'text-warning' }
  if (estado === 'DONE') return { text: 'Concluído', className: 'text-checkout' }
  return null
}

// T6 · MULTIPLE — seleção de escala (US-07). A lista é a própria ação.
export function MultipleScreen({ data, onSelect, onChangeNumber }: MultipleScreenProps) {
  const { nome, opcoes } = data

  return (
    <Screen header={<AppHeader onChangeNumber={onChangeNumber} />}>
      <div className="pt-2">
        <h2 className="text-h2 font-bold text-ink">Olá, {nome.split(' ')[0]}!</h2>
        <p className="mt-2 text-body text-muted">
          Você está escalado em mais de uma área hoje. Selecione:
        </p>

        <ul className="mt-6 space-y-3">
          {opcoes.map((opcao, i) => {
            const selo = statusSelo(opcao.estado)
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelect(nome, opcao)}
                  className="flex w-full items-center justify-between rounded-card border border-black/10 bg-white p-4 text-left shadow-card transition-colors hover:border-primary/40"
                >
                  <span>
                    <span className="block text-title font-bold text-primary">{opcao.area}</span>
                    <span className="mt-1 block text-label text-muted">
                      {opcao.turno} · {opcao.funcao}
                    </span>
                    {selo && (
                      <span className={`mt-1 block text-helper font-semibold ${selo.className}`}>
                        ● {selo.text}
                      </span>
                    )}
                  </span>
                  <span className="text-2xl text-muted" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Screen>
  )
}
