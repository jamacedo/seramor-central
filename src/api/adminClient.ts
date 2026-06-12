// Client da API admin (Fase 6). Aponta para o mesmo Web App do Apps Script
// (VITE_API_URL) ou usa o mock (adminMock) quando vazio. Reaproveita o
// transporte de rede do MVP (timeout + retry) via `send`.

import { send } from './client'
import { adminMock } from './adminMock'
import { ADMIN_MOCK, ADMIN_TOKEN } from '@/lib/adminEnv'
import type { Area, Turno } from '@/types/api'
import type {
  AdminCheckinResult,
  AdminCheckoutResult,
  AdminDashboardResult,
  AdminEnvelope,
  AdminRequest,
  AdminSearchResult,
  AdminUpdatePhoneResult,
} from '@/types/admin'

const MOCK_DELAY_MS = 500

async function adminPost<T>(req: AdminRequest): Promise<AdminEnvelope<T>> {
  if (ADMIN_MOCK) {
    await new Promise((r) => setTimeout(r, MOCK_DELAY_MS))
    return adminMock(req) as AdminEnvelope<T>
  }
  // Auth (Fase 6 §2): anexa o token compartilhado no corpo quando configurado.
  // O envelope admin tem o mesmo formato do MVP, com `error.code` ampliado.
  const body = ADMIN_TOKEN ? { ...req, token: ADMIN_TOKEN } : req
  return (await send(body)) as unknown as AdminEnvelope<T>
}

export function adminDashboard(
  operador: string,
  opts: { turno?: Turno; data?: string } = {},
): Promise<AdminEnvelope<AdminDashboardResult>> {
  return adminPost({
    action: 'adminDashboard',
    operador,
    ...(opts.turno ? { turno: opts.turno } : {}),
    ...(opts.data ? { data: opts.data } : {}),
  })
}

export function adminSearch(
  operador: string,
  nome: string,
  filters: { area?: Area; turno?: Turno; data?: string } = {},
): Promise<AdminEnvelope<AdminSearchResult>> {
  return adminPost({
    action: 'adminSearch',
    operador,
    nome,
    ...(filters.area ? { area: filters.area } : {}),
    ...(filters.turno ? { turno: filters.turno } : {}),
    ...(filters.data ? { data: filters.data } : {}),
  })
}

export function adminCheckin(
  operador: string,
  e: { telefone: string; data: string; area: Area; turno: Turno },
): Promise<AdminEnvelope<AdminCheckinResult>> {
  return adminPost({ action: 'adminCheckin', operador, ...e })
}

export function adminCheckout(
  operador: string,
  e: { telefone: string; data: string; area: Area; turno: Turno },
): Promise<AdminEnvelope<AdminCheckoutResult>> {
  return adminPost({ action: 'adminCheckout', operador, ...e })
}

export function adminUpdatePhone(
  operador: string,
  voluntarioId: string,
  telefoneNovo: string,
): Promise<AdminEnvelope<AdminUpdatePhoneResult>> {
  return adminPost({ action: 'adminUpdatePhone', operador, voluntarioId, telefoneNovo })
}
