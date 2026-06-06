// Tipos da Fase 6 (painel /admin) — espelham a §5 do doc
// docs/Especificacao_Fase6_Admin.md. Reaproveitam Area/Turno/Escala do MVP.

import type { Area, Turno, Escala, ErrorCode } from '@/types/api'

/** Estado de uma pessoa na escala de hoje (subset do CheckinState do MVP). */
export type AdminPersonState = 'CAN_CHECKIN' | 'IN_SERVICE' | 'DONE'

// ── Erros (catálogo do MVP + novos da Fase 6, §5) ──────────────────
export type AdminErrorCode =
  | ErrorCode
  | 'VOLUNTEER_NOT_FOUND'
  | 'DUPLICATE_PHONE'
  | 'ORIGIN_NOT_FOUND'

export interface AdminError {
  code: AdminErrorCode
  message: string
}

/** Envelope admin — mesmo formato do MVP, com `error` de código ampliado. */
export interface AdminEnvelope<T = unknown> {
  ok: boolean
  data?: T
  error: AdminError | null
}

// ── adminDashboard (§5.1) ──────────────────────────────────────────
export interface StatusCounts {
  escalados: number
  pendentes: number
  emServico: number
  concluidos: number
  comparecimento: number // 0..1 (presentes / escalados)
}

export interface AreaStatus extends StatusCounts {
  area: Area
}

export interface AdminDashboardResult {
  data: string // DD/MM/YYYY
  resumo: StatusCounts
  areas: AreaStatus[]
}

// ── adminSearch (§5.2) ─────────────────────────────────────────────
export interface AdminSearchItem {
  nome: string
  telefone: string
  escala: Escala
  estado: AdminPersonState
  checkinAt?: string
  checkoutAt?: string
}

export interface AdminSearchResult {
  itens: AdminSearchItem[]
}

// ── adminCheckin / adminCheckout (§5.3) ────────────────────────────
export interface AdminCheckinResult {
  nome: string
  area: Area
  checkinAt: string
  manual: true
  operador: string
}

export interface AdminCheckoutResult {
  nome: string
  area: Area
  checkinAt: string
  checkoutAt: string
  duracaoMin: number
  manual: true
  operador: string
}

// ── adminUpdatePhone (§5.4) ────────────────────────────────────────
export type PhoneWriteTarget = 'origem' | 'base'

export interface AdminUpdatePhoneResult {
  nome: string
  area: Area
  telefoneAntigo: string
  telefoneNovo: string
  gravado: PhoneWriteTarget[]
  operador: string
}

// ── Requests ───────────────────────────────────────────────────────
export interface AdminDashboardRequest {
  action: 'adminDashboard'
  operador: string
  turno?: Turno
  /** Data de referência DD/MM/YYYY. Omitido = hoje (servidor). */
  data?: string
}

export interface AdminSearchRequest {
  action: 'adminSearch'
  operador: string
  nome: string
  area?: Area
  turno?: Turno
  /** Data de referência DD/MM/YYYY. Omitido = hoje (servidor). */
  data?: string
}

export interface AdminCheckinRequest {
  action: 'adminCheckin'
  operador: string
  telefone: string
  data: string
  area: Area
  turno: Turno
}

export interface AdminCheckoutRequest {
  action: 'adminCheckout'
  operador: string
  telefone: string
  data: string
  area: Area
  turno: Turno
}

export interface AdminUpdatePhoneRequest {
  action: 'adminUpdatePhone'
  operador: string
  /** Identifica o voluntário na base — par `Área::Nome` (ver buildVoluntarioId). */
  voluntarioId: string
  telefoneNovo: string
}

export type AdminRequest =
  | AdminDashboardRequest
  | AdminSearchRequest
  | AdminCheckinRequest
  | AdminCheckoutRequest
  | AdminUpdatePhoneRequest

/** Monta o id do voluntário usado em adminUpdatePhone (§5.4 — `Área::Nome`). */
export function buildVoluntarioId(area: Area, nome: string): string {
  return `${area}::${nome}`
}

/** Alvo da tela de Cadastro (F6-C). Sem `nome` → abre a busca (fallback). */
export interface CadastroTarget {
  nome?: string
  area?: Area
  telefone?: string
}
