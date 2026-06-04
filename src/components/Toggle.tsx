import { cn } from '@/lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
  id?: string
}

// Toggle one-tap "Salvar meus dados" — marcado por padrão (US-06).
export function Toggle({ checked, onChange, label, hint, id = 'toggle' }: ToggleProps) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-primary' : 'bg-black/20',
        )}
      >
        <span
          className={cn(
            'h-6 w-6 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      <label htmlFor={id} id={`${id}-label`} className="cursor-pointer" onClick={() => onChange(!checked)}>
        <span className="block text-label text-ink">{label}</span>
        {hint && <span className="mt-1 block text-helper text-muted">{hint}</span>}
      </label>
    </div>
  )
}
