import { useCallback, useEffect, useState } from 'react'
import {
  checkin as apiCheckin,
  checkout as apiCheckout,
  registerOutsideSchedule as apiRegister,
  resolve as apiResolve,
  OfflineError,
} from '@/api/client'
import type {
  Area,
  CheckinResult,
  CheckinState,
  CheckoutResult,
  Escala,
  OpcaoMultipla,
  ResolveCanCheckin,
  ResolveDone,
  ResolveInService,
  ResolveMultiple,
  ResolveNotFound,
  ResolveNotScheduled,
} from '@/types/api'
import { clearPhone, loadPhone, savePhone } from '@/lib/storage'
import { normalizePhone } from '@/lib/phone'
import { inferTurno } from '@/lib/date'

// View atual da SPA. Cada estado da máquina mapeia para uma tela
// (Matriz Estado → Tela — Wireframes).
export type View =
  | { kind: 'phone' }
  | { kind: 'loading'; message: string }
  | { kind: 'canCheckin'; data: ResolveCanCheckin }
  | { kind: 'inService'; data: ResolveInService }
  | { kind: 'done'; data: ResolveDone }
  | { kind: 'notFound'; data: ResolveNotFound }
  | { kind: 'notScheduled'; data: ResolveNotScheduled; telefone: string }
  | { kind: 'multiple'; data: ResolveMultiple; telefone: string }
  | { kind: 'presencaExtra'; telefone: string; nome: string; areaSugerida?: Area }
  | { kind: 'successCheckin'; data: CheckinResult }
  | { kind: 'successCheckout'; data: CheckoutResult }
  | { kind: 'error' }
  | { kind: 'offline' }
  | { kind: 'closed' }

/** Dados que a US-10 coleta no formulário (turno é inferido pela hora). */
export interface PresencaExtraForm {
  area: Area
  funcao: string
  motivo: string
}

interface FlowApi {
  view: View
  phone: string
  oneTap: boolean
  setPhone: (digits: string) => void
  setOneTap: (next: boolean) => void
  submitPhone: () => void
  resolvePhone: (telefone: string) => void
  confirmCheckin: (escala: Escala) => void
  confirmCheckout: (escala: Escala) => void
  selectOption: (nome: string, opcao: OpcaoMultipla) => void
  goPresencaExtra: () => void
  confirmPresencaExtra: (telefone: string, form: PresencaExtraForm) => void
  changeNumber: () => void
  finish: () => void
  retry: () => void
}

export function useCheckinFlow(): FlowApi {
  const [view, setView] = useState<View>({ kind: 'phone' })
  const [phone, setPhone] = useState('')
  const [oneTap, setOneTap] = useState(true) // default ON (US-06)
  // Última ação executada, para o botão "Tentar novamente" da tela de erro.
  const [lastAction, setLastAction] = useState<(() => void) | null>(null)

  const handleNetworkError = useCallback((err: unknown) => {
    setView(err instanceof OfflineError ? { kind: 'offline' } : { kind: 'error' })
  }, [])

  // Mapeia um envelope de /resolve para a view correspondente.
  const applyResolve = useCallback((tel: string, env: Awaited<ReturnType<typeof apiResolve>>) => {
    if (!env.ok || !env.state) {
      setView({ kind: 'error' })
      return
    }
    const state: CheckinState = env.state
    switch (state) {
      case 'CAN_CHECKIN':
        setView({ kind: 'canCheckin', data: env.data as ResolveCanCheckin })
        break
      case 'IN_SERVICE':
        setView({ kind: 'inService', data: env.data as ResolveInService })
        break
      case 'DONE':
        setView({ kind: 'done', data: env.data as ResolveDone })
        break
      case 'NOT_SCHEDULED':
        setView({ kind: 'notScheduled', data: env.data as ResolveNotScheduled, telefone: tel })
        break
      case 'MULTIPLE':
        setView({ kind: 'multiple', data: env.data as ResolveMultiple, telefone: tel })
        break
      case 'NOT_FOUND':
      default:
        setView({ kind: 'notFound', data: env.data as ResolveNotFound })
    }
  }, [])

  const doResolve = useCallback(
    (tel: string) => {
      setLastAction(() => () => doResolve(tel))
      setView({ kind: 'loading', message: 'Buscando sua escala…' })
      apiResolve(tel)
        .then((env) => applyResolve(tel, env))
        .catch(handleNetworkError)
    },
    [applyResolve, handleNetworkError],
  )

  // One-tap: telefone salvo → pula a T1 e resolve direto (US-06).
  useEffect(() => {
    const saved = loadPhone()
    if (saved) {
      setPhone(saved)
      doResolve(saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitPhone = useCallback(() => {
    const tel = normalizePhone(phone)
    if (tel.length !== 11) return
    doResolve(tel)
  }, [phone, doResolve])

  const confirmCheckin = useCallback(
    (escala: Escala) => {
      const run = () => {
        setLastAction(() => run)
        setView({ kind: 'loading', message: 'Confirmando…' })
        apiCheckin({ telefone: escala.telefone, data: escala.data, area: escala.area, turno: escala.turno })
          .then((env) => {
            if (env.ok && env.data) {
              if (oneTap) savePhone(escala.telefone)
              setView({ kind: 'successCheckin', data: env.data })
            } else if (env.error?.code === 'ALREADY_CHECKED_IN') {
              // Idempotente: não é erro → re-resolve para IN_SERVICE.
              doResolve(escala.telefone)
            } else {
              setView({ kind: 'error' })
            }
          })
          .catch(handleNetworkError)
      }
      run()
    },
    [oneTap, doResolve, handleNetworkError],
  )

  const confirmCheckout = useCallback(
    (escala: Escala) => {
      const run = () => {
        setLastAction(() => run)
        setView({ kind: 'loading', message: 'Confirmando…' })
        apiCheckout({ telefone: escala.telefone, data: escala.data, area: escala.area, turno: escala.turno })
          .then((env) => {
            if (env.ok && env.data) {
              if (oneTap) savePhone(escala.telefone)
              setView({ kind: 'successCheckout', data: env.data })
            } else if (env.error?.code === 'ALREADY_CHECKED_OUT') {
              doResolve(escala.telefone) // → DONE
            } else {
              setView({ kind: 'error' })
            }
          })
          .catch(handleNetworkError)
      }
      run()
    },
    [oneTap, doResolve, handleNetworkError],
  )

  // T6 · seleção de uma escala (US-07): navega direto ao estado da linha
  // escolhida, sem nova chamada (a opção já carrega seu `estado`).
  const selectOption = useCallback((nome: string, opcao: OpcaoMultipla) => {
    const escala: Escala = {
      telefone: opcao.telefone,
      data: opcao.data,
      area: opcao.area,
      turno: opcao.turno,
      funcao: opcao.funcao,
    }
    if (opcao.estado === 'IN_SERVICE') {
      setView({ kind: 'inService', data: { nome, escala, checkinAt: opcao.checkinAt ?? '' } })
    } else if (opcao.estado === 'DONE') {
      setView({ kind: 'done', data: { nome, escala, checkinAt: opcao.checkinAt ?? '', checkoutAt: '' } })
    } else {
      setView({ kind: 'canCheckin', data: { nome, escala } })
    }
  }, [])

  // T2b → T7: abre o formulário de presença fora da escala (US-10).
  // Função inicia vazia neste cenário; só a área é pré-sugerida.
  const goPresencaExtra = useCallback(() => {
    setView((v) =>
      v.kind === 'notScheduled'
        ? {
            kind: 'presencaExtra',
            telefone: v.telefone,
            nome: v.data.nome,
            areaSugerida: v.data.areaSugerida,
          }
        : v,
    )
  }, [])

  const confirmPresencaExtra = useCallback(
    (telefone: string, form: PresencaExtraForm) => {
      const run = () => {
        setLastAction(() => run)
        setView({ kind: 'loading', message: 'Confirmando…' })
        apiRegister({
          telefone,
          area: form.area,
          turno: inferTurno(),
          funcao: form.funcao,
          motivo: form.motivo,
        })
          .then((env) => {
            // US-10 é, na prática, um check-in → reusa a tela de sucesso do
            // check-in (PresencaExtraResult contém nome/area/checkinAt).
            if (env.ok && env.data) {
              if (oneTap) savePhone(telefone)
              setView({ kind: 'successCheckin', data: env.data })
            } else {
              setView({ kind: 'error' })
            }
          })
          .catch(handleNetworkError)
      }
      run()
    },
    [oneTap, handleNetworkError],
  )

  const changeNumber = useCallback(() => {
    clearPhone()
    setPhone('')
    setView({ kind: 'phone' })
  }, [])

  // Finalizar: vai para a tela de encerramento, que tenta fechar a aba.
  // Renderizar antes de fechar garante o fallback gracioso quando o
  // navegador bloqueia window.close() (abas abertas pelo usuário).
  const finish = useCallback(() => {
    setView({ kind: 'closed' })
  }, [])

  const retry = useCallback(() => {
    if (lastAction) lastAction()
    else setView({ kind: 'phone' })
  }, [lastAction])

  return {
    view,
    phone,
    oneTap,
    setPhone,
    setOneTap,
    submitPhone,
    resolvePhone: doResolve,
    confirmCheckin,
    confirmCheckout,
    selectOption,
    goPresencaExtra,
    confirmPresencaExtra,
    changeNumber,
    finish,
    retry,
  }
}
