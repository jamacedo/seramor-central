import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'checkin' | 'checkout' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  fullWidth?: boolean
}

// Botão da biblioteca (Descritivo §5). Altura 56px, texto 20px/700.
// Estado loading desabilita e mostra spinner inline (evita duplo toque).
const base =
  'inline-flex items-center justify-center gap-2 rounded-btn font-bold text-[20px] ' +
  'min-h-[56px] px-6 transition-colors disabled:cursor-not-allowed select-none'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white disabled:bg-primary/40',
  checkin: 'bg-checkin text-white disabled:bg-checkin/40',
  checkout: 'bg-checkout text-white disabled:bg-checkout/40',
  secondary: 'bg-white text-ink border border-black/10 disabled:opacity-50',
  ghost: 'bg-transparent text-primary font-medium text-label min-h-[44px] disabled:opacity-50',
}

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(base, variants[variant], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading && <Spinner size={22} className="text-current" />}
      {children}
    </button>
  )
}
