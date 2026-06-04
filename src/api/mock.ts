// Mock fiel ao Contrato de API v1.2. Implementa a máquina de estados a
// partir das flags In/Out de uma "planilha" em memória, igual ao Apps
// Script. Permite rodar o caminho feliz ponta a ponta sem backend.
//
// Telefones-semente para teste:
//   11999998888 → Maria Silva · Louvor · Vocal · Manhã (caminho feliz)
//   11888887777 → João Pereira · Som · Técnico · Noite
// Qualquer outro telefone válido → NOT_FOUND.

import type {
  ApiEnvelope,
  ApiRequest,
  Area,
  Turno,
} from '@/types/api'

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
}

function todayStamp(d = new Date()): string {
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return f.format(d) // DD/MM/YYYY
}

function nowStamp(d = new Date()): string {
  const date = todayStamp(d)
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  return `${date} ${time}`
}

const today = todayStamp()

// "Planilha" Checkin Ser Amor (mutável em memória durante a sessão).
const sheet: SheetRow[] = [
  {
    telefone: '11999998888',
    nome: 'Maria Silva',
    area: 'Louvor',
    turno: 'Manhã',
    funcao: 'Vocal',
    data: today,
    In: false,
    Out: false,
  },
  {
    telefone: '11888887777',
    nome: 'João Pereira',
    area: 'Som',
    turno: 'Noite',
    funcao: 'Técnico',
    data: today,
    In: false,
    Out: false,
  },
]

function findRow(telefone: string): SheetRow | undefined {
  return sheet.find((r) => r.telefone === telefone && r.data === today)
}

function escalaOf(r: SheetRow) {
  return {
    telefone: r.telefone,
    data: r.data,
    area: r.area,
    turno: r.turno,
    funcao: r.funcao,
  }
}

function ok<T>(data: T, state?: ApiEnvelope['state']): ApiEnvelope<T> {
  return { ok: true, state, data, error: null }
}

function resolve(telefone: string): ApiEnvelope {
  const row = findRow(telefone)
  if (!row) {
    return ok(
      {
        message:
          'Não encontramos este número na nossa base de voluntários. Por favor, procure o líder do seu ministério para atualizar seu cadastro.',
      },
      'NOT_FOUND',
    )
  }
  if (row.In && row.Out) {
    return ok(
      { nome: row.nome, escala: escalaOf(row), checkinAt: row.checkinAt, checkoutAt: row.checkoutAt },
      'DONE',
    )
  }
  if (row.In && !row.Out) {
    return ok({ nome: row.nome, escala: escalaOf(row), checkinAt: row.checkinAt }, 'IN_SERVICE')
  }
  return ok({ nome: row.nome, escala: escalaOf(row) }, 'CAN_CHECKIN')
}

function checkin(telefone: string): ApiEnvelope {
  const row = findRow(telefone)
  if (!row) return { ok: false, error: { code: 'ROW_NOT_FOUND', message: 'Linha não encontrada' } }
  if (row.In) {
    // Idempotente: devolve o carimbo existente sem duplicar.
    return { ok: false, error: { code: 'ALREADY_CHECKED_IN', message: row.checkinAt ?? '' } }
  }
  row.In = true
  row.checkinAt = nowStamp()
  return ok({ nome: row.nome, area: row.area, checkinAt: row.checkinAt })
}

function checkout(telefone: string): ApiEnvelope {
  const row = findRow(telefone)
  if (!row) return { ok: false, error: { code: 'ROW_NOT_FOUND', message: 'Linha não encontrada' } }
  if (!row.In) return { ok: false, error: { code: 'NOT_CHECKED_IN', message: '' } }
  if (row.Out) return { ok: false, error: { code: 'ALREADY_CHECKED_OUT', message: '' } }
  row.Out = true
  row.checkoutAt = nowStamp()
  const duracaoMin = diffMin(row.checkinAt!, row.checkoutAt)
  return ok({
    nome: row.nome,
    area: row.area,
    checkinAt: row.checkinAt,
    checkoutAt: row.checkoutAt,
    duracaoMin,
  })
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
  switch (req.action) {
    case 'resolve':
      return resolve(req.telefone)
    case 'checkin':
      return checkin(req.telefone)
    case 'checkout':
      return checkout(req.telefone)
    case 'registerOutsideSchedule':
      return { ok: false, error: { code: 'NOT_REGISTERED', message: 'Fora do escopo do caminho feliz' } }
    default:
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Ação desconhecida' } }
  }
}
