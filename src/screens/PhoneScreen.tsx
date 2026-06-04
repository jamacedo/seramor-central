import { Button } from '@/components/Button'
import { PhoneInput } from '@/components/PhoneInput'
import { Screen } from '@/components/Screen'
import { todayLong } from '@/lib/date'
import { isValidPhone } from '@/lib/phone'
import logoSerAmor from '@/assets/logo-ser-amor.png'

interface PhoneScreenProps {
  phone: string
  onChange: (digits: string) => void
  onSubmit: () => void
}

// T1 · Entrada — captura de telefone (US-01).
export function PhoneScreen({ phone, onChange, onSubmit }: PhoneScreenProps) {
  const valid = isValidPhone(phone)

  return (
    <Screen
      footer={
        <Button disabled={!valid} onClick={onSubmit}>
          Buscar
        </Button>
      }
    >
      <form
        className="flex flex-1 flex-col justify-center"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSubmit()
        }}
      >
        <div className="flex flex-col items-center text-center">
          {/* Logo Ser Amor */}
          <img src={logoSerAmor} alt="Ser Amor" className="mb-4 h-24 w-24" />
          <p className="text-label font-semibold text-primary">{todayLong()}</p>
          <h1 className="mt-2 text-h1 font-bold text-ink">Bem-vinda(o)!</h1>
          <p className="mt-1 text-body text-muted">
            Confirme sua presença como voluntário na Igreja Ser Amor
          </p>
        </div>

        <div className="mt-10">
          <PhoneInput value={phone} onChange={onChange} autoFocus />
        </div>

        {/* submit implícito para o Enter do teclado numérico */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Screen>
  )
}
