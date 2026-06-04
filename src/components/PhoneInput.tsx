import { useId } from 'react'
import { cn } from '@/lib/cn'
import { maskPhone } from '@/lib/phone'

interface PhoneInputProps {
  value: string // dígitos crus (sem máscara)
  onChange: (digits: string) => void
  error?: string | null
  autoFocus?: boolean
}

// Input de telefone (T1). Altura 64px, label persistente, inputmode numeric,
// máscara (XX) XXXXX-XXXX. Helper vira erro quando inválido (Wireframes T1).
export function PhoneInput({ value, onChange, error, autoFocus }: PhoneInputProps) {
  const id = useId()
  const helperId = `${id}-helper`

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-label text-ink">
        Seu telefone
      </label>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        autoFocus={autoFocus}
        placeholder="(11) 99999-8888"
        value={maskPhone(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 11))}
        aria-describedby={helperId}
        aria-invalid={Boolean(error)}
        className={cn(
          'h-16 w-full rounded-input border bg-white px-4 text-body text-ink',
          'placeholder:text-muted/60',
          error ? 'border-error' : 'border-black/15',
        )}
      />
      <p id={helperId} className={cn('mt-2 text-helper', error ? 'text-error' : 'text-muted')}>
        {error ?? 'Digite os 11 dígitos com DDD'}
      </p>
    </div>
  )
}
