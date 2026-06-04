// Tipos do Contrato de API v1.2 — Check-in Igreja Ser Amor.
// Fonte: docs/Contrato_API_CheckIn_Ser_Amor.md

/** Estados resolvidos por /resolve (máquina de estados, §3 do contrato). */
export type CheckinState =
  | 'NOT_FOUND'
  | 'NOT_SCHEDULED'
  | 'CAN_CHECKIN'
  | 'IN_SERVICE'
  | 'DONE'
  | 'MULTIPLE'

export type Turno = 'Manhã' | 'Noite'

/** Enum oficial de Áreas (§1 do contrato). */
export const AREAS = [
  'Acolhimento',
  'Central',
  'Clubinho',
  'Ekoe',
  'Foto e Vídeo',
  'Iluminação',
  'Logística',
  'Louvor',
  'Multimídia',
  'Som',
  'Transmissão',
] as const
export type Area = (typeof AREAS)[number]

/** Identifica unicamente uma linha de escala: Telefone + Data + Área + Turno. */
export interface Escala {
  telefone: string
  data: string // DD/MM/YYYY
  area: Area
  turno: Turno
  funcao: string
}

/** Códigos de erro do catálogo (§5 do contrato). */
export type ErrorCode =
  | 'ROW_NOT_FOUND'
  | 'ALREADY_CHECKED_IN'
  | 'NOT_CHECKED_IN'
  | 'ALREADY_CHECKED_OUT'
  | 'NOT_REGISTERED'
  | 'MISSING_REASON'
  | 'DUPLICATE'
  | 'SHEET_UNAVAILABLE'
  | 'INVALID_INPUT'

export interface ApiError {
  code: ErrorCode
  message: string
}

/** Envelope padrão (§1 do contrato). HTTP é sempre 200; confiar em `ok`. */
export interface ApiEnvelope<T = unknown> {
  ok: boolean
  state?: CheckinState
  data?: T
  error: ApiError | null
}

// ── Payloads de /resolve por estado ────────────────────────────────

export interface ResolveNotFound {
  message: string
}

export interface ResolveNotScheduled {
  nome: string
  podeRegistrarForaDaEscala: boolean
  areaSugerida?: Area
  funcaoSugerida?: string
  message: string
}

export interface ResolveCanCheckin {
  nome: string
  escala: Escala
}

export interface ResolveInService {
  nome: string
  escala: Escala
  checkinAt: string // DD/MM/YYYY HH:MM
}

export interface ResolveDone {
  nome: string
  escala: Escala
  checkinAt: string
  checkoutAt: string
}

export interface OpcaoMultipla extends Escala {
  estado: CheckinState
  checkinAt?: string
}

export interface ResolveMultiple {
  nome: string
  opcoes: OpcaoMultipla[]
}

// ── Payloads das ações ─────────────────────────────────────────────

export interface CheckinResult {
  nome: string
  area: Area
  checkinAt: string
}

export interface CheckoutResult {
  nome: string
  area: Area
  checkinAt: string
  checkoutAt: string
  duracaoMin: number
}

export interface PresencaExtraResult {
  nome: string
  area: Area
  checkinAt: string
  observacao: string
}

// ── Requests ───────────────────────────────────────────────────────

export interface ResolveRequest {
  action: 'resolve'
  telefone: string
}

export interface CheckinRequest {
  action: 'checkin'
  telefone: string
  data: string
  area: Area
  turno: Turno
}

export interface CheckoutRequest {
  action: 'checkout'
  telefone: string
  data: string
  area: Area
  turno: Turno
}

export interface PresencaExtraRequest {
  action: 'registerOutsideSchedule'
  telefone: string
  area: Area
  turno: Turno
  funcao: string
  motivo: string
}

export type ApiRequest =
  | ResolveRequest
  | CheckinRequest
  | CheckoutRequest
  | PresencaExtraRequest
