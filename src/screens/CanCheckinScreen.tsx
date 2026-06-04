import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { Toggle } from '@/components/Toggle'
import type { Escala, ResolveCanCheckin } from '@/types/api'
import logoSerAmor from '@/assets/logo-ser-amor.png'

interface CanCheckinScreenProps {
  data: ResolveCanCheckin
  oneTap: boolean
  onOneTapChange: (next: boolean) => void
  onConfirm: (escala: Escala) => void
  onBack: () => void
}

// T3 · CAN_CHECKIN — confirmar entrada (US-04). Caminho feliz ⭐
// Sem identity card (decisão do stakeholder). Botão verde.
export function CanCheckinScreen({
  data,
  oneTap,
  onOneTapChange,
  onConfirm,
  onBack,
}: CanCheckinScreenProps) {
  const { nome, escala } = data

  return (
    <Screen
      header={<AppHeader onBack={onBack} />}
      footer={
        <Button variant="checkin" onClick={() => onConfirm(escala)}>
          ✓ Confirmar Check-in
        </Button>
      }
    >
      <div className="flex flex-1 flex-col justify-center text-center">
        <img src={logoSerAmor} alt="Ser Amor" className="mx-auto mb-6 h-20 w-20" />
        <h2 className="text-h2 font-bold text-ink">Bem vinda(o), {nome.split(' ')[0]}!</h2>
        <p className="mx-auto mt-6 max-w-[20rem] text-body text-ink">
          Confirmar sua entrada na área{' '}
          <span className="font-bold text-primary">{escala.area}</span> como{' '}
          <span className="font-bold">{escala.funcao}</span>?
        </p>

        <div className="mx-auto mt-10 w-full max-w-[22rem] text-left">
          <Toggle
            id="onetap"
            checked={oneTap}
            onChange={onOneTapChange}
            label="Salvar meus dados neste aparelho"
            hint="Seu telefone fica salvo só neste aparelho. Você pode remover depois."
          />
        </div>
      </div>
    </Screen>
  )
}
