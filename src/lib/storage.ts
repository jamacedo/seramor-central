// One-tap (US-06): guarda o telefone no aparelho para pular a T1.
// Cifragem leve (ofuscação) para não deixar o número em texto puro no
// localStorage. O esquema definitivo é pendência §16.4 da Especificação;
// isolado aqui para troca trivial por uma cifra real depois.

const KEY = 'seramor.checkin.phone'

function obfuscate(value: string): string {
  // XOR simples + base64. Suficiente para "não em texto puro" no MVP.
  const k = 0x5a
  const xored = Array.from(value, (c) => String.fromCharCode(c.charCodeAt(0) ^ k)).join('')
  return btoa(xored)
}

function deobfuscate(stored: string): string {
  try {
    const k = 0x5a
    const xored = atob(stored)
    return Array.from(xored, (c) => String.fromCharCode(c.charCodeAt(0) ^ k)).join('')
  } catch {
    return ''
  }
}

export function savePhone(phone: string): void {
  try {
    localStorage.setItem(KEY, obfuscate(phone))
  } catch {
    /* localStorage indisponível (modo privado) — ignora silenciosamente */
  }
}

export function loadPhone(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const phone = deobfuscate(raw)
    return phone.length === 11 ? phone : null
  } catch {
    return null
  }
}

export function clearPhone(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignora */
  }
}
