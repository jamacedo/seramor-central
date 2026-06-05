import { useId, useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { Toggle } from '@/components/Toggle'
import { AREAS, type Area } from '@/types/api'
import type { PresencaExtraForm } from '@/state/useCheckinFlow'

interface PresencaExtraScreenProps {
  telefone: string
  nome: string
  areaSugerida?: Area
  oneTap: boolean
  onOneTapChange: (next: boolean) => void
  onConfirm: (telefone: string, form: PresencaExtraForm) => void
  onBack: () => void
}

const fieldClass =
  'w-full rounded-input border border-black/15 bg-white px-4 py-3 text-body text-ink ' +
  'focus:border-primary'

// T7 · US-10 — presença fora da escala (só a partir de T2b, cadastrado).
// Campos: Área (enum oficial), Função, Motivo (obrigatório). Turno é
// inferido pela hora no envio (o formulário não pede turno).
export function PresencaExtraScreen({
  telefone,
  nome,
  areaSugerida,
  oneTap,
  onOneTapChange,
  onConfirm,
  onBack,
}: PresencaExtraScreenProps) {
  const [area, setArea] = useState<Area | ''>(areaSugerida ?? '')
  const [funcao, setFuncao] = useState('') // inicia vazio neste cenário
  const [motivo, setMotivo] = useState('')
  const ids = useId()

  const valid = area !== '' && funcao.trim() !== '' && motivo.trim() !== ''

  return (
    <Screen
      header={<AppHeader onBack={onBack} />}
      footer={
        <Button
          disabled={!valid}
          onClick={() => valid && onConfirm(telefone, { area: area as Area, funcao, motivo })}
        >
          Confirmar presença
        </Button>
      }
    >
      <form
        className="pt-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onConfirm(telefone, { area: area as Area, funcao, motivo })
        }}
      >
        <h2 className="text-h2 font-bold text-ink">Registrar presença</h2>
        <p className="mt-2 text-helper text-muted">
          {nome.split(' ')[0]}, você não está na escala de hoje. Informe os dados:
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label htmlFor={`${ids}-area`} className="mb-2 block text-label text-ink">
              Área *
            </label>
            <select
              id={`${ids}-area`}
              value={area}
              onChange={(e) => setArea(e.target.value as Area)}
              className={fieldClass}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${ids}-funcao`} className="mb-2 block text-label text-ink">
              Função *
            </label>
            <input
              id={`${ids}-funcao`}
              type="text"
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              placeholder="Ex.: Vocal, Recepção…"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor={`${ids}-motivo`} className="mb-2 block text-label text-ink">
              Motivo *
            </label>
            <textarea
              id={`${ids}-motivo`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex.: substituindo Fulano, remanejado pelo líder"
              className={`${fieldClass} resize-none`}
            />
          </div>

          {/* One-tap (US-06) — igual à T3, após o Motivo. */}
          <Toggle
            id="onetap-presenca"
            checked={oneTap}
            onChange={onOneTapChange}
            label="Salvar meus dados neste aparelho"
            hint="Seu telefone fica salvo só neste aparelho. Você pode remover depois."
          />
        </div>
      </form>
    </Screen>
  )
}
