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
