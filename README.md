# Check-in de Voluntários · Igreja Ser Amor

SPA mobile-first (React + Vite + TypeScript + Tailwind) para o check-in de
voluntários via QR Code genérico. O voluntário se identifica **apenas pelo
telefone**; o sistema infere área, função, turno e culto cruzando com a escala
do dia e oferece **check-in ou check-out** conforme o estado.

> Fase atual: **MVP (Fases 1–4)** — caminho feliz implementado.
> Backend: Apps Script (Web App). Ver `docs/`.

## Stack

- **React 18 + Vite** — SPA leve, hospedável estaticamente ou via HTML Service.
- **TypeScript** estrito.
- **Tailwind CSS** com os tokens de marca aprovados (`tailwind.config.ts`).
- **Sem dependências de runtime além do React** — ícones e helpers inline.

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
```

Sem `VITE_API_URL` configurado, a app usa o **mock fiel ao Contrato de API v1.2**
(`src/api/mock.ts`), permitindo rodar o caminho feliz ponta a ponta.

### Telefones de teste (mock)

| Telefone        | Cenário                                            |
| --------------- | -------------------------------------------------- |
| `11999998888`   | Maria Silva · Louvor · Vocal — caminho feliz ⭐    |
| `11888887777`   | João Pereira · Som · Técnico                       |
| qualquer outro  | `NOT_FOUND`                                         |

Fluxo demonstrável: digitar `11999998888` → **Confirmar Check-in** → sucesso →
reabrir (one-tap salvo) → **Confirmar Check-out** → sucesso com duração.

### Apontando para o backend real

```bash
cp .env.example .env
# VITE_API_URL=https://script.google.com/macros/s/.../exec
```

O client envia `POST` com `text/plain` (evita preflight CORS no Apps Script) e
faz **retry automático 1×** em timeout > 5s (Especificação §9).

## Estrutura

```
src/
├── types/api.ts          # tipos do Contrato de API v1.2
├── lib/                  # phone (máscara/normalização), date, storage (one-tap), cn
├── api/
│   ├── client.ts         # POST text/plain, timeout + retry; mock se sem VITE_API_URL
│   └── mock.ts           # backend fake fiel ao contrato (máquina de estados In/Out)
├── state/useCheckinFlow  # máquina de estados → view
├── components/           # Button, PhoneInput, Toggle, Screen, AppHeader, SummaryCard, icons
└── screens/              # T1 Phone · T3 CanCheckin · T4 InService · T8 Success · L/E/O · terminais
```

## Status das telas

| Tela | Estado | Status |
| ---- | ------ | ------ |
| T1 Entrada | `phone` | ✅ |
| T3 CAN_CHECKIN | `canCheckin` | ✅ caminho feliz |
| T4 IN_SERVICE | `inService` | ✅ caminho feliz |
| T8 Sucesso (check-in/out) | `success*` | ✅ |
| L / E / O transversais | — | ✅ |
| T2a NOT_FOUND · T5 DONE | — | ✅ básico |
| T2b NOT_SCHEDULED · T6 MULTIPLE · T7 US-10 | — | 🔲 SHOULD (próxima iteração) |
```
