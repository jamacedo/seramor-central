import { AppHeader } from '@/components/AppHeader'
import { Screen } from '@/components/Screen'
import { Spinner } from '@/components/Spinner'

// L · Loading fullscreen (resolve). Microcopy honesto.
export function LoadingScreen({ message }: { message: string }) {
  return (
    <Screen header={<AppHeader />} centerContent>
      <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
        <Spinner size={44} className="text-primary" />
        <p className="mt-5 text-body text-muted">{message}</p>
      </div>
    </Screen>
  )
}
