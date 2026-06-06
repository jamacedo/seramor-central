// Helpers de data/hora em pt-BR (America/Sao_Paulo).
// O "hoje" e os carimbos canônicos são responsabilidade do servidor;
// aqui só formatamos para exibição.

const TZ = 'America/Sao_Paulo'

/** Ex.: "Domingo, 7 de Junho" — linha contextual da T1. */
export function todayLong(date = new Date()): string {
  const s = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  // Capitaliza dia da semana e mês, mantendo "de" minúsculo.
  return s.replace(/^./, (c) => c.toUpperCase()).replace(/ de (\w)/, (_, c) => ` de ${c.toUpperCase()}`)
}

/** Data de hoje em America/Sao_Paulo no formato ISO `YYYY-MM-DD` (p/ `<input type=date>`). */
export function todayISO(date = new Date()): string {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** `YYYY-MM-DD` → `DD/MM/YYYY` (formato do contrato). */
export function isoToBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** `YYYY-MM-DD` → "Domingo, 13 de Junho" (data de calendário, sem shift de fuso). */
export function longDateFromISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const s = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(y, m - 1, d))
  return s.replace(/^./, (c) => c.toUpperCase()).replace(/ de (\w)/, (_, c) => ` de ${c.toUpperCase()}`)
}

/** Extrai "HH:MM" de um carimbo "DD/MM/YYYY HH:MM". */
export function timeOf(stamp: string | undefined): string {
  if (!stamp) return ''
  const parts = stamp.split(' ')
  return parts[1] ?? ''
}

/** Converte minutos em "2h25" ou "45min". */
export function formatDuration(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Infere o turno pela hora atual (janelas do Contrato §1: Manhã 06–13,
 * Noite 15–22). Usado na US-10, cujo formulário não pede turno.
 */
export function inferTurno(date = new Date()): 'Manhã' | 'Noite' {
  const hourStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    hour12: false,
  }).format(date)
  const hour = Number(hourStr)
  return hour < 14 ? 'Manhã' : 'Noite'
}
