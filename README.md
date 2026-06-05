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

| Telefone        | Estado resolvido | Cenário                                                        |
| --------------- | ---------------- | -------------------------------------------------------------- |
| `11999998888`   | `CAN_CHECKIN`    | Maria Silva · Louvor · Vocal — caminho feliz ⭐                |
| `11888887777`   | `CAN_CHECKIN`    | João Pereira · Som · Técnico                                   |
| `11777776666`   | `NOT_SCHEDULED`  | Ana Costa · cadastrada, sem escala hoje → habilita a **US-10** |
| `11666665555`   | `MULTIPLE`       | Carla Souza · 2 escalas hoje (Louvor + Acolhimento "Em serviço") |
| `11000000000`   | erro (tela E)    | simula `SHEET_UNAVAILABLE` → "Algo deu errado" + Tentar novamente |
| `11000000001`   | offline (tela O) | simula ausência de conexão → "Você está sem conexão"          |
| qualquer outro  | `NOT_FOUND`      | telefone fora da base                                          |

**Fluxos demonstráveis:**
- **Caminho feliz:** `11999998888` → Confirmar Check-in → sucesso → reabrir
  (one-tap salvo) → Confirmar Check-out → sucesso com duração.
- **Não escalado + presença fora da escala (US-10):** `11777776666` → "Vou servir
  hoje mesmo assim" → preencher Área/Função/Motivo → Confirmar presença.
- **Escala múltipla (US-07):** `11666665555` → selecionar uma área → check-in/out
  da linha escolhida (o turno é o mesmo nas duas, então sempre cai na seleção).

> O mock guarda o estado `In`/`Out` em memória durante a sessão; um *reload*
> reinicia a "planilha". Os carimbos de horário usam o relógio do navegador.

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
| T8 Sucesso (check-in/out/US-10) | `success*` | ✅ |
| L / E / O transversais | — | ✅ |
| T2a NOT_FOUND · T5 DONE | — | ✅ |
| T2b NOT_SCHEDULED | `notScheduled` | ✅ |
| T6 MULTIPLE (US-07) | `multiple` | ✅ |
| T7 Presença fora da escala (US-10) | `presencaExtra` | ✅ |
```
