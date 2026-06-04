import { useEffect } from 'react'
import { Screen } from '@/components/Screen'
import logoSerAmor from '@/assets/logo-ser-amor.png'

// Tela de encerramento (fallback de "Finalizar"). Tenta fechar a aba de novo
// e, se o navegador bloquear, orienta o voluntário a fechar manualmente.
export function ClosedScreen() {
  useEffect(() => {
    window.close()
  }, [])

  return (
    <Screen centerContent>
      <div className="flex flex-col items-center text-center">
        <img src={logoSerAmor} alt="Ser Amor" className="mb-6 h-20 w-20 opacity-60" />
        <h2 className="text-h2 font-bold text-ink">Tudo certo!</h2>
        <p className="mt-3 max-w-[20rem] text-body text-muted">
          Você já pode fechar esta aba. Obrigado por servir! ❤
        </p>
      </div>
    </Screen>
  )
}
