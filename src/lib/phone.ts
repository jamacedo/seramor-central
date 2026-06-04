// Normalização e máscara de telefone (Contrato §1).
// Formato canônico: 11 dígitos, sem país, sem máscara (DDNNNNNNNNN).

/** Remove tudo que não é dígito e descarta o prefixo 55 (13 dígitos). */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    digits = digits.slice(2)
  }
  return digits.slice(0, 11)
}

/** Telefone válido = exatamente 11 dígitos após normalização. */
export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw).length === 11
}

/** Aplica a máscara visual (XX) XXXXX-XXXX progressivamente. */
export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
