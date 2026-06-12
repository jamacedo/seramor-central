// Helpers de texto.

/** Normaliza para busca: sem acento, minúsculo, trim. */
export function deburr(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
