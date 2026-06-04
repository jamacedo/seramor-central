import type { Config } from 'tailwindcss'

// Tokens de marca aprovados (jun/2026) — Igreja Ser Amor.
// Fonte: docs/Descritivo_Design_Telas_MVP.md §2 e memória brand-tokens-seramor.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#D3642A',        // marca, cabeçalho, links, data na T1
        checkin: '#16A34A',        // botão Confirmar Check-in (verde)
        checkout: '#2563EB',       // botão Confirmar Check-out (azul)
        success: '#16A34A',        // ícone ✓ e tela de sucesso
        warning: '#D97706',        // NOT_SCHEDULED / atenção
        error: '#DC2626',          // NOT_FOUND / falhas
        ink: '#1C1917',            // texto principal (near-black quente)
        muted: '#78716C',          // texto secundário / helpers
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // escala aprovada (tamanho, line-height)
        h1: ['32px', { lineHeight: '1.18', fontWeight: '700' }],
        h2: ['28px', { lineHeight: '1.22', fontWeight: '700' }],
        title: ['26px', { lineHeight: '1.25', fontWeight: '700' }],
        body: ['18px', { lineHeight: '1.45', fontWeight: '400' }],
        label: ['16px', { lineHeight: '1.30', fontWeight: '500' }],
        helper: ['14px', { lineHeight: '1.35', fontWeight: '400' }],
      },
      borderRadius: {
        card: '16px',
        input: '12px',
        btn: '12px',
      },
      boxShadow: {
        card: '0 8px 24px #1C191714',
      },
      maxWidth: {
        screen: '440px', // largura máxima de conteúdo (mobile-first)
      },
    },
  },
  plugins: [],
} satisfies Config
