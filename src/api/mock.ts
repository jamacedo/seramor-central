// Mock fiel ao Contrato de API v1.2. Implementa a máquina de estados a
// partir das flags In/Out de uma "planilha" em memória, igual ao Apps
// Script, e um índice `Base Voluntarios` para o fallback (cadastrado).
//
// Telefones-semente para teste (ver README):
//   11999998888 → Maria Silva · Louvor · Vocal · Manhã   (CAN_CHECKIN ⭐)
//   11888887777 → João Pereira · Som · Técnico · Noite    (CAN_CHECKIN)
//   11777776666 → Ana Costa  (cadastrada, sem escala hoje) (NOT_SCHEDULED → US-10)
//   11666665555 → Carla Souza (2 escalas hoje)             (MULTIPLE)
//   11000000000 → gatilho de erro do servidor              (SHEET_UNAVAILABLE → tela E)
//   11000000001 → gatilho de offline                       (sem conexão → tela O)
//   qualquer outro telefone válido                          (NOT_FOUND)

import type { ApiEnvelope, ApiRequest, Area, OpcaoMultipla, Turno } from '@/types/api'

/** Telefones-gatilho para exercitar os estados transversais (testes). */
export const ERROR_PHONE = '11000000000'
export const OFFLINE_PHONE = '11000000001'

interface SheetRow {
  telefone: string
  nome: string
  area: Area
  turno: Turno
  funcao: string
  data: string // DD/MM/YYYY (hoje)
  In: boolean
  Out: boolean
  checkinAt?: string // DD/MM/YYYY HH:MM
  checkoutAt?: string
  observacao?: string
}

interface BaseVoluntario {
  telefone: string
  nome: string
  area: Area
  funcao: string
  ativo: boolean
}

function todayStamp(d = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function nowStamp(d = new Date()): string {
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  return `${todayStamp(d)} ${time}`
}

const today = todayStamp()

// Aba "Checkin Ser Amor" (escala + presença) — mutável durante a sessão.
const sheet: SheetRow[] = [
  { telefone: '11999998888', nome: 'Maria Silva', area: 'Louvor', turno: 'Manhã', funcao: 'Vocal', data: today, In: false, Out: false },
  { telefone: '11888887777', nome: 'João Pereira', area: 'Som', turno: 'Noite', funcao: 'Técnico', data: today, In: false, Out: false },
  // Carla: duas escalas hoje (mesmo turno → inferência não desempata → MULTIPLE).
  { telefone: '11666665555', nome: 'Carla Souza', area: 'Louvor', turno: 'Manhã', funcao: 'Vocal', data: today, In: false, Out: false },
  { telefone: '11666665555', nome: 'Carla Souza', area: 'Acolhimento', turno: 'Manhã', funcao: 'Recepção', data: today, In: true, Out: false, checkinAt: `${today} 09:05` },
]

// Aba "Base Voluntarios" (índice compilado pelo App Script).
const baseVoluntarios: BaseVoluntario[] = [
  { telefone: '11999998888', nome: 'Maria Silva', area: 'Louvor', funcao: 'Vocal', ativo: true },
  { telefone: '11888887777', nome: 'João Pereira', area: 'Som', funcao: 'Técnico', ativo: true },
  { telefone: '11666665555', nome: 'Carla Souza', area: 'Louvor', funcao: 'Vocal', ativo: true },
  // Ana: cadastrada mas sem escala hoje → NOT_SCHEDULED + US-10.
  { telefone: '11777776666', nome: 'Ana Costa', area: 'Acolhimento', funcao: 'Recepção', ativo: true },
]

function rowsToday(telefone: string): SheetRow[] {
  return sheet.filter((r) => r.telefone === telefone && r.data === today)
}

function findByKey(telefone: string, area: Area, turno: Turno): SheetRow | undefined {
  return sheet.find(
    (r) => r.telefone === telefone && r.data === today && r.area === area && r.turno === turno,
  )
}

function escalaOf(r: SheetRow) {
  return { telefone: r.telefone, data: r.data, area: r.area, turno: r.turno, funcao: r.funcao }
}

function stateOf(r: SheetRow): 'CAN_CHECKIN' | 'IN_SERVICE' | 'DONE' {
  if (r.In && r.Out) return 'DONE'
  if (r.In) return 'IN_SERVICE'
  return 'CAN_CHECKIN'
}

function ok<T>(data: T, state?: ApiEnvelope['state']): ApiEnvelope<T> {
  return { ok: true, state, data, error: null }
}

function resolve(telefone: string): ApiEnvelope {
  const rows = rowsToday(telefone)

  if (rows.length === 0) {
    const base = baseVoluntarios.find((b) => b.telefone === telefone && b.ativo)
    if (base) {
      // A cópia é renderizada pelo front (lib/copy.ts); aqui só os dados.
      return ok(
        {
          nome: base.nome,
          podeRegistrarForaDaEscala: true,
          areaSugerida: base.area,
          funcaoSugerida: base.funcao,
        },
        'NOT_SCHEDULED',
      )
    }
    return ok({}, 'NOT_FOUND')
  }

  if (rows.length >= 2) {
    // Sem telefone por opção (igual ao backend real).
    const opcoes: OpcaoMultipla[] = rows.map((r) => ({
      data: r.data,
      area: r.area,
      turno: r.turno,
      funcao: r.funcao,
      estado: stateOf(r),
      ...(r.checkinAt ? { checkinAt: r.checkinAt } : {}),
      ...(r.checkoutAt ? { checkoutAt: r.checkoutAt } : {}),
    }))
    return ok({ nome: rows[0].nome, opcoes }, 'MULTIPLE')
  }

  const r = rows[0]
  const state = stateOf(r)
  if (state === 'DONE') {
    return ok({ nome: r.nome, escala: escalaOf(r), checkinAt: r.checkinAt, checkoutAt: r.checkoutAt }, 'DONE')
  }
  if (state === 'IN_SERVICE') {
    return ok({ nome: r.nome, escala: escalaOf(r), checkinAt: r.checkinAt }, 'IN_SERVICE')
  }
  return ok({ nome: r.nome, escala: escalaOf(r) }, 'CAN_CHECKIN')
}

function checkin(telefone: string, area: Area, turno: Turno): ApiEnvelope {
  const row = findByKey(telefone, area, turno)
  if (!row) return { ok: false, error: { code: 'ROW_NOT_FOUND', message: 'Linha não encontrada' } }
  if (row.In) return { ok: false, error: { code: 'ALREADY_CHECKED_IN', message: row.checkinAt ?? '' } }
  row.In = true
  row.checkinAt = nowStamp()
  return ok({ nome: row.nome, area: row.area, checkinAt: row.checkinAt })
}

function checkout(telefone: string, area: Area, turno: Turno): ApiEnvelope {
  const row = findByKey(telefone, area, turno)
  if (!row) return { ok: false, error: { code: 'ROW_NOT_FOUND', message: 'Linha não encontrada' } }
  if (!row.In) return { ok: false, error: { code: 'NOT_CHECKED_IN', message: '' } }
  if (row.Out) return { ok: false, error: { code: 'ALREADY_CHECKED_OUT', message: '' } }
  row.Out = true
  row.checkoutAt = nowStamp()
  return ok({
    nome: row.nome,
    area: row.area,
    checkinAt: row.checkinAt,
    checkoutAt: row.checkoutAt,
    duracaoMin: diffMin(row.checkinAt!, row.checkoutAt),
  })
}

function registerOutsideSchedule(
  telefone: string,
  area: Area,
  turno: Turno,
  funcao: string,
  motivo: string,
): ApiEnvelope {
  const base = baseVoluntarios.find((b) => b.telefone === telefone && b.ativo)
  if (!base) return { ok: false, error: { code: 'NOT_REGISTERED', message: '' } }
  if (!motivo?.trim()) return { ok: false, error: { code: 'MISSING_REASON', message: '' } }
  if (findByKey(telefone, area, turno)) {
    return { ok: false, error: { code: 'DUPLICATE', message: '' } }
  }
  const checkinAt = nowStamp()
  sheet.push({
    telefone, nome: base.nome, area, turno, funcao, data: today,
    In: true, Out: false, checkinAt, observacao: motivo,
  })
  return ok({ nome: base.nome, area, checkinAt, observacao: motivo })
}

function diffMin(a: string, b: string): number {
  const t = (s: string) => {
    const [, time] = s.split(' ')
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }
  return Math.max(0, t(b) - t(a))
}

/** Dispatcher que imita o doPost(e) roteado por `action`. */
export function mockApi(req: ApiRequest): ApiEnvelope {
  // Gatilho de teste: simula falha de acesso à planilha em qualquer ação.
  if (req.telefone === ERROR_PHONE) {
    return { ok: false, error: { code: 'SHEET_UNAVAILABLE', message: 'Planilha indisponível' } }
  }

  switch (req.action) {
    case 'resolve':
      return resolve(req.telefone)
    case 'checkin':
      return checkin(req.telefone, req.area, req.turno)
    case 'checkout':
      return checkout(req.telefone, req.area, req.turno)
    case 'registerOutsideSchedule':
      return registerOutsideSchedule(req.telefone, req.area, req.turno, req.funcao, req.motivo)
    default:
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Ação desconhecida' } }
  }
}
