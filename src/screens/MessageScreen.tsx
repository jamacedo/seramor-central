import type { ReactNode } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'

type Tone = 'success' | 'warning' | 'error' | 'info'

interface MessageScreenProps {
  icon: ReactNode
  title: string
  body?: ReactNode
  /** Conteúdo extra (ex.: card de resumo). */
  extra?: ReactNode
  primary?: { label: string; onClick: () => void; tone?: Tone }
  secondaryLabel?: string
  onSecondary?: () => void
  onChangeNumber?: () => void
}

// Bloco de mensagem reutilizável (Descritivo §5 — Message Block).
// Cobre T2a NOT_FOUND, T5 DONE, E (erro) e O (offline).
export function MessageScreen({
  icon,
  title,
  body,
  extra,
  primary,
  secondaryLabel,
  onSecondary,
  onChangeNumber,
}: MessageScreenProps) {
  return (
    <Screen
      header={<AppHeader onChangeNumber={onChangeNumber} />}
      centerContent
      footer={
        (primary || secondaryLabel) && (
          <div className="space-y-2">
            {primary && (
              <Button variant="primary" onClick={primary.onClick}>
                {primary.label}
              </Button>
            )}
            {secondaryLabel && onSecondary && (
              <Button variant="ghost" onClick={onSecondary}>
                {secondaryLabel}
              </Button>
            )}
          </div>
        )
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-2">{icon}</div>
        <h2 className="text-h2 font-bold text-ink">{title}</h2>
        {body && <div className="mt-3 max-w-[20rem] text-body text-muted">{body}</div>}
        {extra && <div className="mt-6 w-full max-w-[22rem]">{extra}</div>}
      </div>
    </Screen>
  )
}
