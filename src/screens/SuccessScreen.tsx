import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { SummaryCard } from '@/components/SummaryCard'
import { CheckCircle } from '@/components/icons'
import { formatDuration, timeOf } from '@/lib/date'
import type { CheckinResult, CheckoutResult } from '@/types/api'

type SuccessScreenProps =
  | {
      variant: 'checkin'
      data: CheckinResult
      oneTapSaved: boolean
      onFinish: () => void
      onChangeNumber?: () => void
    }
  | {
      variant: 'checkout'
      data: CheckoutResult
      oneTapSaved: boolean
      onFinish: () => void
      onChangeNumber?: () => void
    }

// T8 · Sucesso — variações check-in / check-out (US-04/05).
// A US-10 reaproveita a variação "checkin" (é um check-in fora da escala).
export function SuccessScreen(props: SuccessScreenProps) {
  const { variant, data, oneTapSaved, onFinish, onChangeNumber } = props

  const title = variant === 'checkin' ? 'Check-in confirmado!' : 'Check-out confirmado!'

  const rows =
    variant === 'checkout'
      ? [
          { icon: '👤', label: <strong>{data.nome}</strong> },
          { icon: '📍', label: data.area },
          {
            icon: '⏱',
            label: (
              <span>
                {timeOf((data as CheckoutResult).checkinAt)} → {timeOf((data as CheckoutResult).checkoutAt)}
                {'  ·  '}
                <strong>{formatDuration((data as CheckoutResult).duracaoMin)} servidas</strong>
              </span>
            ),
          },
        ]
      : [
          // check-in e US-10 compartilham o mesmo resumo (nome · área · entrada).
          { icon: '👤', label: <strong>{data.nome}</strong> },
          { icon: '📍', label: data.area },
          { icon: '⏱', label: <span>Entrada {timeOf((data as CheckinResult).checkinAt)}</span> },
        ]

  return (
    <Screen
      header={<AppHeader onChangeNumber={onChangeNumber} />}
      centerContent
      footer={
        <Button variant="ghost" onClick={onFinish}>
          Fechar
        </Button>
      }
    >
      <div className="flex flex-col items-center text-center">
        <CheckCircle className="text-success motion-safe:animate-[pop_400ms_ease-out]" size={84} />
        <h1 className="mt-5 text-h1 font-bold text-ink">{title}</h1>

        <div className="mt-6 w-full max-w-[22rem]">
          <SummaryCard rows={rows} />
        </div>

        {oneTapSaved && (
          <p className="mt-5 flex items-center gap-2 text-helper text-success">
            <CheckCircle size={18} /> Seus dados ficaram salvos neste aparelho
          </p>
        )}
      </div>
    </Screen>
  )
}
