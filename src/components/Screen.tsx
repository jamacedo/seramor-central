import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ScreenProps {
  header?: ReactNode
  /** Conteúdo central (rola se preciso). */
  children: ReactNode
  /** Ações fixas na parte inferior (botão primário + link). */
  footer?: ReactNode
  /** Centraliza o conteúdo verticalmente (telas de mensagem/sucesso). */
  centerContent?: boolean
}

// Esqueleto comum a todas as telas (Wireframes — Estrutura comum):
// header leve → conteúdo (1 foco) → ação primária fixa embaixo.
export function Screen({ header, children, footer, centerContent }: ScreenProps) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-screen flex-col px-4">
      {header}
      <main
        className={cn(
          'flex flex-1 flex-col',
          centerContent ? 'justify-center' : 'pt-2',
        )}
      >
        {children}
      </main>
      {footer && <div className="pb-safe pt-3">{footer}</div>}
    </div>
  )
}
