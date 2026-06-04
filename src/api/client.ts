// Client da API. Aponta para o Web App do Apps Script (VITE_API_URL) ou,
// se vazio, usa o mock fiel ao contrato. Implementa o comportamento de rede
// definido na Especificação §9: timeout >5s com retry automático 1×.

import type {
  ApiEnvelope,
  ApiRequest,
  CheckinRequest,
  CheckinResult,
  CheckoutRequest,
  CheckoutResult,
  ResolveRequest,
} from '@/types/api'
import { mockApi } from './mock'

const API_URL = import.meta.env.VITE_API_URL as string | undefined
const TIMEOUT_MS = 5000

export class OfflineError extends Error {
  constructor() {
    super('offline')
    this.name = 'OfflineError'
  }
}

export class NetworkError extends Error {
  constructor(message = 'network') {
    super(message)
    this.name = 'NetworkError'
  }
}

async function postOnce(req: ApiRequest, signal: AbortSignal): Promise<ApiEnvelope> {
  // Apps Script: text/plain evita preflight CORS (Contrato §6).
  const res = await fetch(API_URL as string, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(req),
    signal,
  })
  // HTTP status não é confiável (Apps Script sempre 200); confiar no corpo.
  return (await res.json()) as ApiEnvelope
}

/** POST com timeout + 1 retry silencioso (Especificação §9). */
async function post(req: ApiRequest): Promise<ApiEnvelope> {
  // Sem backend configurado → mock local (latência simulada leve).
  if (!API_URL) {
    await new Promise((r) => setTimeout(r, 600))
    return mockApi(req)
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OfflineError()
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      return await postOnce(req, controller.signal)
    } catch (err) {
      if (attempt === 1) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new OfflineError()
        }
        throw new NetworkError((err as Error).message)
      }
      // primeira falha: retry silencioso
    } finally {
      clearTimeout(timer)
    }
  }
  throw new NetworkError()
}

// ── API tipada por ação ────────────────────────────────────────────

export function resolve(telefone: string): Promise<ApiEnvelope> {
  const req: ResolveRequest = { action: 'resolve', telefone }
  return post(req)
}

export function checkin(
  e: Pick<CheckinRequest, 'telefone' | 'data' | 'area' | 'turno'>,
): Promise<ApiEnvelope<CheckinResult>> {
  return post({ action: 'checkin', ...e }) as Promise<ApiEnvelope<CheckinResult>>
}

export function checkout(
  e: Pick<CheckoutRequest, 'telefone' | 'data' | 'area' | 'turno'>,
): Promise<ApiEnvelope<CheckoutResult>> {
  return post({ action: 'checkout', ...e }) as Promise<ApiEnvelope<CheckoutResult>>
}
