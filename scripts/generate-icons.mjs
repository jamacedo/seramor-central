// Gera os ícones do PWA a partir da logo (fundo branco; maskable com
// área de segurança). Reexecute após trocar a logo por uma de alta resolução:
//   node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const SRC = 'src/assets/logo-ser-amor.png'
const OUT = 'public'
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

await mkdir(OUT, { recursive: true })

// size = lado do ícone; ratio = quanto a logo ocupa (resto vira margem branca).
async function icon(size, ratio, file) {
  const inner = Math.round(size * ratio)
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${file}`)
  console.log(`✓ ${file} (${size}px)`)
}

await icon(192, 0.82, 'pwa-192x192.png')
await icon(512, 0.82, 'pwa-512x512.png')
await icon(512, 0.62, 'maskable-icon-512x512.png') // área de segurança maior
await icon(180, 0.82, 'apple-touch-icon.png')
await icon(32, 0.9, 'favicon-32x32.png')
