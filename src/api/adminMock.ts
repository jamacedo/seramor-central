// Mock fiel ao contrato da Fase 6 (docs/Especificacao_Fase6_Admin.md §5).
// Implementa os 4 action's de admin sobre uma "planilha" em memória, no mesmo
// espírito do src/api/mock.ts do MVP. Usado quando não há VITE_API_URL.

import type { Area, Turno } from '@/types/api'
import type {
  AdminDashboardResult,
  AdminEnvelope,
  AdminPersonState,
  AdminRequest,
  AdminSearchItem,
  AreaStatus,
  StatusCounts,
} from '@/types/admin'

interface Row {
  telefone: string
  nome: string
  area: Area
  turno: Turno
  funcao: string
  In: boolean
  Out: boolean
  checkinAt?: string
  checkoutAt?: string
  observacao?: string
}

interface BaseRow {
  nome: string
  area: Area
  funcao: string
  telefone: string
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

// Aba "Checkin Ser Amor" — escala de hoje com estados variados (mutável).
const sheet: Row[] = [
  { telefone: '11999990001', nome: 'Maria Oliveira', area: 'Louvor', turno: 'Manhã', funcao: 'Vocal', In: true, Out: true, checkinAt: `${today} 08:32`, checkoutAt: `${today} 11:05` },
  { telefone: '11999990002', nome: 'Pablo Alcântara', area: 'Louvor', turno: 'Manhã', funcao: 'Tecladista', In: false, Out: false },
  { telefone: '11999990003', nome: 'Rafael Lima', area: 'Louvor', turno: 'Manhã', funcao: 'Baixo', In: true, Out: false, checkinAt: `${today} 08:40` },
  { telefone: '11999990004', nome: 'Beatriz Souza', area: 'Acolhimento', turno: 'Manhã', funcao: 'Recepção', In: true, Out: false, checkinAt: `${today} 08:15` },
  { telefone: '11999990005', nome: 'Carla Mendes', area: 'Acolhimento', turno: 'Manhã', funcao: 'Recepção', In: false, Out: false },
  { telefone: '11999990006', nome: 'João Pereira', area: 'Som', turno: 'Manhã', funcao: 'Técnico', In: true, Out: false, checkinAt: `${today} 07:55` },
  { telefone: '11999990007', nome: 'Pablo Souza', area: 'Som', turno: 'Noite', funcao: 'Técnico', In: false, Out: false },
  { telefone: '11999990008', nome: 'Lucas Andrade', area: 'Clubinho', turno: 'Manhã', funcao: 'Contador', In: true, Out: true, checkinAt: `${today} 08:50`, checkoutAt: `${today} 11:30` },
  { telefone: '11999990009', nome: 'Fernanda Dias', area: 'Clubinho', turno: 'Manhã', funcao: 'Auxiliar', In: false, Out: false },
]

// Aba "Base Voluntarios" (índice compilado) — base completa, inclui quem não
// está escalado hoje. Usada por adminUpdatePhone.
const base: BaseRow[] = [
  { nome: 'Maria Oliveira', area: 'Louvor', funcao: 'Vocal', telefone: '11999990001', ativo: true },
  { nome: 'Pablo Alcântara', area: 'Louvor', funcao: 'Tecladista', telefone: '11999990002', ativo: true },
  { nome: 'Rafael Lima', area: 'Louvor', funcao: 'Baixo', telefone: '11999990003', ativo: true },
  { nome: 'Beatriz Souza', area: 'Acolhimento', funcao: 'Recepção', telefone: '11999990004', ativo: true },
  { nome: 'Carla Mendes', area: 'Acolhimento', funcao: 'Recepção', telefone: '', ativo: true }, // sem telefone
  { nome: 'João Pereira', area: 'Som', funcao: 'Técnico', telefone: '11999990006', ativo: true },
  { nome: 'Pablo Souza', area: 'Som', funcao: 'Técnico', telefone: '11999990007', ativo: true },
  { nome: 'Lucas Andrade', area: 'Clubinho', funcao: 'Contador', telefone: '11999990008', ativo: true },
  { nome: 'Fernanda Dias', area: 'Clubinho', funcao: 'Auxiliar', telefone: '11999990009', ativo: true },
  { nome: 'Mariana Castro', area: 'Ekoe', funcao: 'Apoio', telefone: '11999990010', ativo: true }, // fora da escala de hoje
]

function deburr(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function estadoOf(r: Row): AdminPersonState {
  if (r.In && r.Out) return 'DONE'
  if (r.In) return 'IN_SERVICE'
  return 'CAN_CHECKIN'
}

function diffMin(a: string, b: string): number {
  const min = (s: string) => {
    const [, time] = s.split(' ')
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }
  return Math.max(0, min(b) - min(a))
}

function ok<T>(data: T): AdminEnvelope<T> {
  return { ok: true, data, error: null }
}

function fail(code: string, message = ''): AdminEnvelope<never> {
  return { ok: false, error: { code: code as never, message } }
}

function emptyCounts(): StatusCounts {
  return { escalados: 0, pendentes: 0, emServico: 0, concluidos: 0, comparecimento: 0 }
}

function dashboard(turno?: Turno): AdminDashboardResult {
  const rows = sheet.filter((r) => !turno || r.turno === turno)
  const byArea = new Map<Area, AreaStatus>()
  const resumo = emptyCounts()

  for (const r of rows) {
    const a =
      byArea.get(r.area) ?? { area: r.area, ...emptyCounts() }
    a.escalados += 1
    resumo.escalados += 1
    const st = estadoOf(r)
    if (st === 'CAN_CHECKIN') {
      a.pendentes += 1
      resumo.pendentes += 1
    } else if (st === 'IN_SERVICE') {
      a.emServico += 1
      resumo.emServico += 1
    } else {
      a.concluidos += 1
      resumo.concluidos += 1
    }
    byArea.set(r.area, a)
  }

  const ratio = (c: StatusCounts) =>
    c.escalados === 0 ? 0 : (c.emServico + c.concluidos) / c.escalados

  // A ordenação dos cards é responsabilidade do front (VisaoScreen).
  const areas = [...byArea.values()].map((a) => ({ ...a, comparecimento: ratio(a) }))
  resumo.comparecimento = ratio(resumo)

  return { data: today, resumo, areas }
}

function search(nome: string, area?: Area, turno?: Turno): AdminSearchItem[] {
  const q = deburr(nome)
  return sheet
    .filter((r) => (!area || r.area === area) && (!turno || r.turno === turno))
    // Sem nome (<2 chars) lista todos que batem nos filtros de área/turno.
    .filter((r) => (q.length >= 2 ? deburr(r.nome).includes(q) : true))
    .map((r) => ({
      nome: r.nome,
      telefone: r.telefone,
      escala: { telefone: r.telefone, data: today, area: r.area, turno: r.turno, funcao: r.funcao },
      estado: estadoOf(r),
      ...(r.checkinAt ? { checkinAt: r.checkinAt } : {}),
      ...(r.checkoutAt ? { checkoutAt: r.checkoutAt } : {}),
    }))
}

function findRow(telefone: string, area: Area, turno: Turno): Row | undefined {
  return sheet.find((r) => r.telefone === telefone && r.area === area && r.turno === turno)
}

function audit(row: Row, operador: string): void {
  const tag = `[manual: ${operador} em ${nowStamp()}]`
  row.observacao = row.observacao ? `${row.observacao} ${tag}` : tag
}

/** Dispatcher que imita o doPost(e) do Apps Script, roteado por `action`. */
export function adminMock(req: AdminRequest): AdminEnvelope {
  switch (req.action) {
    case 'adminDashboard':
      return ok(dashboard(req.turno))

    case 'adminSearch':
      return ok({ itens: search(req.nome, req.area, req.turno) })

    case 'adminCheckin': {
      const row = findRow(req.telefone, req.area, req.turno)
      if (!row) return fail('ROW_NOT_FOUND')
      if (row.In) return fail('ALREADY_CHECKED_IN', row.checkinAt ?? '')
      row.In = true
      row.checkinAt = nowStamp()
      audit(row, req.operador)
      return ok({ nome: row.nome, area: row.area, checkinAt: row.checkinAt, manual: true, operador: req.operador })
    }

    case 'adminCheckout': {
      const row = findRow(req.telefone, req.area, req.turno)
      if (!row) return fail('ROW_NOT_FOUND')
      if (!row.In) return fail('NOT_CHECKED_IN')
      if (row.Out) return fail('ALREADY_CHECKED_OUT')
      row.Out = true
      row.checkoutAt = nowStamp()
      audit(row, req.operador)
      return ok({
        nome: row.nome,
        area: row.area,
        checkinAt: row.checkinAt ?? '',
        checkoutAt: row.checkoutAt,
        duracaoMin: diffMin(row.checkinAt ?? row.checkoutAt, row.checkoutAt),
        manual: true,
        operador: req.operador,
      })
    }

    case 'adminUpdatePhone': {
      const [area, nome] = req.voluntarioId.split('::')
      const person = base.find((b) => b.area === area && b.nome === nome && b.ativo)
      if (!person) return fail('VOLUNTEER_NOT_FOUND')
      const dup = base.find((b) => b !== person && b.ativo && b.telefone === req.telefoneNovo)
      if (dup) return fail('DUPLICATE_PHONE')
      const telefoneAntigo = person.telefone
      // Origem + compilada: base + linhas da escala da mesma pessoa.
      person.telefone = req.telefoneNovo
      for (const r of sheet) {
        if (r.nome === person.nome && r.area === person.area) r.telefone = req.telefoneNovo
      }
      return ok({
        nome: person.nome,
        area: person.area,
        telefoneAntigo,
        telefoneNovo: req.telefoneNovo,
        gravado: ['origem', 'base'],
        operador: req.operador,
      })
    }
  }
}
