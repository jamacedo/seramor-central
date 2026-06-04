import { useCallback, useEffect, useState } from 'react'
import {
  checkin as apiCheckin,
  checkout as apiCheckout,
  resolve as apiResolve,
  OfflineError,
} from '@/api/client'
import type {
  CheckinResult,
  CheckinState,
  CheckoutResult,
  Escala,
  ResolveCanCheckin,
  ResolveDone,
  ResolveInService,
  ResolveNotFound,
} from '@/types/api'
import { clearPhone, loadPhone, savePhone } from '@/lib/storage'
import { normalizePhone } from '@/lib/phone'

// View atual da SPA. Cada estado da máquina mapeia para uma tela
// (Matriz Estado → Tela — Wireframes).
export type View =
  | { kind: 'phone' }
  | { kind: 'loading'; message: string }
  | { kind: 'canCheckin'; data: ResolveCanCheckin }
  | { kind: 'inService'; data: ResolveInService }
  | { kind: 'done'; data: ResolveDone }
  | { kind: 'notFound'; data: ResolveNotFound }
  | { kind: 'successCheckin'; data: CheckinResult }
  | { kind: 'successCheckout'; data: CheckoutResult }
  | { kind: 'error' }
  | { kind: 'offline' }
  | { kind: 'closed' }

interface FlowApi {
  view: View
  phone: string
  oneTap: boolean
  setPhone: (digits: string) => void
  setOneTap: (next: boolean) => void
  submitPhone: () => void
  confirmCheckin: (escala: Escala) => void
  confirmCheckout: (escala: Escala) => void
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
  const applyResolve = useCallback((env: Awaited<ReturnType<typeof apiResolve>>) => {
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
      case 'NOT_FOUND':
        setView({ kind: 'notFound', data: env.data as ResolveNotFound })
        break
      // NOT_SCHEDULED e MULTIPLE: fora do caminho feliz (Fase 3 — SHOULD).
      // Tratados como orientação genérica até serem implementados.
      default:
        setView({ kind: 'notFound', data: { message: env.data && 'message' in (env.data as object) ? (env.data as ResolveNotFound).message : 'Não foi possível resolver sua escala.' } })
    }
  }, [])

  const doResolve = useCallback(
    (tel: string) => {
      setLastAction(() => () => doResolve(tel))
      setView({ kind: 'loading', message: 'Buscando sua escala…' })
      apiResolve(tel)
        .then((env) => applyResolve(env))
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
    confirmCheckin,
    confirmCheckout,
    changeNumber,
    finish,
    retry,
  }
}
