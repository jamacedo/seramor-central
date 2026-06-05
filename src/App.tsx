import { useCheckinFlow } from '@/state/useCheckinFlow'
import { PhoneScreen } from '@/screens/PhoneScreen'
import { CanCheckinScreen } from '@/screens/CanCheckinScreen'
import { InServiceScreen } from '@/screens/InServiceScreen'
import { MultipleScreen } from '@/screens/MultipleScreen'
import { PresencaExtraScreen } from '@/screens/PresencaExtraScreen'
import { SuccessScreen } from '@/screens/SuccessScreen'
import { LoadingScreen } from '@/screens/LoadingScreen'
import { ClosedScreen } from '@/screens/ClosedScreen'
import { MessageScreen } from '@/screens/MessageScreen'
import { SummaryCard } from '@/components/SummaryCard'
import { AlertTriangle, Ban, CheckCircle, WifiOff } from '@/components/icons'
import { timeOf } from '@/lib/date'

export default function App() {
  const flow = useCheckinFlow()
  const { view } = flow

  switch (view.kind) {
    case 'phone':
      return (
        <PhoneScreen phone={flow.phone} onChange={flow.setPhone} onSubmit={flow.submitPhone} />
      )

    case 'loading':
      return <LoadingScreen message={view.message} />

    case 'canCheckin':
      return (
        <CanCheckinScreen
          data={view.data}
          oneTap={flow.oneTap}
          onOneTapChange={flow.setOneTap}
          onConfirm={flow.confirmCheckin}
          onBack={flow.changeNumber}
        />
      )

    case 'inService':
      return (
        <InServiceScreen
          data={view.data}
          onConfirm={flow.confirmCheckout}
          onChangeNumber={flow.changeNumber}
        />
      )

    case 'successCheckin':
      return (
        <SuccessScreen
          variant="checkin"
          data={view.data}
          oneTapSaved={flow.oneTap}
          onFinish={flow.finish}
        />
      )

    case 'successCheckout':
      return (
        <SuccessScreen
          variant="checkout"
          data={view.data}
          oneTapSaved={flow.oneTap}
          onFinish={flow.finish}
        />
      )

    // T6 · MULTIPLE — seleção de escala (US-07).
    case 'multiple':
      return (
        <MultipleScreen
          data={view.data}
          onSelect={flow.selectOption}
          onChangeNumber={flow.changeNumber}
        />
      )

    // T7 · US-10 — presença fora da escala.
    case 'presencaExtra':
      return (
        <PresencaExtraScreen
          telefone={view.telefone}
          nome={view.nome}
          areaSugerida={view.areaSugerida}
          oneTap={flow.oneTap}
          onOneTapChange={flow.setOneTap}
          onConfirm={flow.confirmPresencaExtra}
          onBack={() => flow.resolvePhone(view.telefone)}
        />
      )

    case 'closed':
      return <ClosedScreen />

    // T5 · DONE — serviço concluído (US-05). Terminal, sem ação primária.
    case 'done': {
      const { nome, checkinAt, checkoutAt } = view.data
      return (
        <MessageScreen
          icon={<CheckCircle size={72} className="text-success" />}
          title={`Olá, ${nome.split(' ')[0]}!`}
          body="Seu serviço de hoje já está completo. Obrigado por servir! ❤"
          extra={
            <SummaryCard
              rows={[
                { icon: 'Entrada', label: <strong>{timeOf(checkinAt)}</strong> },
                { icon: 'Saída', label: <strong>{timeOf(checkoutAt)}</strong> },
              ]}
            />
          }
          secondaryLabel="Sair / Usar outro número"
          onSecondary={flow.changeNumber}
        />
      )
    }

    // T2a · NOT_FOUND — não cadastrado (US-02). Sem ação de gravação.
    case 'notFound':
      return (
        <MessageScreen
          icon={<Ban size={64} className="text-muted" />}
          title="Número não encontrado"
          body={view.data.message}
          primary={{ label: 'Tentar outro número', onClick: flow.changeNumber }}
        />
      )

    // T2b · NOT_SCHEDULED — cadastrado, sem escala hoje (US-03).
    // Oferece a US-10 se o backend autorizar (telefone cadastrado).
    case 'notScheduled':
      return (
        <MessageScreen
          icon={<AlertTriangle size={64} className="text-warning" />}
          title={`Olá, ${view.data.nome.split(' ')[0]}!`}
          // A saudação já vai no título; remove o "Olá, Nome!" do corpo.
          body={view.data.message.replace(/^Olá,[^!]*!\s*/, '')}
          primary={
            view.data.podeRegistrarForaDaEscala
              ? { label: 'Vou servir hoje mesmo assim', onClick: flow.goPresencaExtra }
              : undefined
          }
          onChangeNumber={flow.changeNumber}
        />
      )

    // E · Erro / Timeout / Planilha indisponível. Nunca expõe códigos.
    case 'error':
      return (
        <MessageScreen
          icon={<AlertTriangle size={64} className="text-warning" />}
          title="Algo deu errado"
          body="Não conseguimos concluir agora. Tente de novo em instantes ou procure o líder."
          primary={{ label: 'Tentar novamente', onClick: flow.retry }}
        />
      )

    // O · Offline.
    case 'offline':
      return (
        <MessageScreen
          icon={<WifiOff size={64} className="text-muted" />}
          title="Você está sem conexão"
          body="Conecte-se e tente novamente, ou procure o líder."
          primary={{ label: 'Tentar novamente', onClick: flow.retry }}
        />
      )
  }
}
