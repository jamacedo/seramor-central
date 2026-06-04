import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { SummaryCard } from '@/components/SummaryCard'
import { timeOf } from '@/lib/date'
import type { Escala, ResolveInService } from '@/types/api'

interface InServiceScreenProps {
  data: ResolveInService
  onConfirm: (escala: Escala) => void
  onChangeNumber: () => void
}

// T4 · IN_SERVICE — confirmar saída (US-05). Botão azul (distinto do verde).
export function InServiceScreen({ data, onConfirm, onChangeNumber }: InServiceScreenProps) {
  const { nome, escala, checkinAt } = data
  const hora = timeOf(checkinAt)

  return (
    <Screen
      header={<AppHeader onChangeNumber={onChangeNumber} />}
      footer={
        <Button variant="checkout" onClick={() => onConfirm(escala)}>
          Confirmar Check-out
        </Button>
      }
    >
      <div className="flex flex-1 flex-col justify-center">
        <h2 className="text-center text-h2 font-bold text-ink">Olá, {nome.split(' ')[0]}!</h2>

        <div className="mx-auto mt-6 w-full max-w-[22rem]">
          <SummaryCard
            rows={[
              { icon: '📍', label: <span>Ministério <strong>{escala.area}</strong></span> },
              { icon: '⏱', label: <span>Entrada às <strong>{hora}</strong></span> },
            ]}
          />
        </div>

        <p className="mx-auto mt-6 max-w-[20rem] text-center text-body text-ink">
          Você entrou às {hora}. Confirmar saída do Ministério{' '}
          <span className="font-bold">{escala.area}</span>?
        </p>
      </div>
    </Screen>
  )
}
