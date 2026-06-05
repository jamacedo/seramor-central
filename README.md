# Check-in de Voluntários · Igreja Ser Amor

SPA mobile-first (React + Vite + TypeScript + Tailwind) para o check-in de
voluntários via QR Code genérico. O voluntário se identifica **apenas pelo
telefone**; o sistema infere área, função, turno e culto cruzando com a escala
do dia e oferece **check-in ou check-out** conforme o estado.

> Fase atual: **MVP (Fases 1–4)** — caminho feliz implementado.
> **Fase 6 (painel `/admin`)** em andamento — front scaffolded contra mock
> (ver abaixo). Backend: Apps Script (Web App). Ver `docs/`.

## Stack

- **React 18 + Vite** — SPA leve, **instalável como PWA** (hospedagem estática).
- **TypeScript** estrito.
- **Tailwind CSS** com os tokens de marca aprovados (`tailwind.config.ts`).
- **vite-plugin-pwa** (Workbox) — service worker + manifest.
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

## Painel `/admin` (Fase 6 — em andamento)

Painel administrativo na rota **`/admin`**, no mesmo bundle, protegido por
**Cloudflare Zero Trust** (sem login no app). Spec: `docs/Especificacao_Fase6_Admin.md`.

Três frentes: **Visão** (dashboard global por área), **Serviço** (check-in/out
manual por nome) e **Cadastro/telefone** (atualização do telefone na origem +
compilada).

```bash
npm run dev      # http://localhost:5173/admin
```

> O **backend Apps Script dos endpoints de admin ainda não existe**. O flag
> **`VITE_ADMIN_MOCK=1`** (no `.env`) faz o `/admin` rodar contra o mock
> (`src/api/adminMock.ts`) mesmo com `VITE_API_URL` apontando pro backend real do
> MVP. Remova/`0` quando o Apps Script implementar `adminDashboard` / `adminSearch`
> / `adminCheckin` / `adminCheckout` / `adminUpdatePhone`.

> Em dev/mock a identidade do operador é fixa (`admin@seramor.com.br`). Em
> produção, vem do `/cdn-cgi/access/get-identity` do Zero Trust; o **Sair** dispara
> `/cdn-cgi/access/logout`.

Mock admin: 9 escalados em 4 áreas (Louvor/Acolhimento/Som/Clubinho) com estados
variados; **Carla Mendes está sem telefone** (caso para testar a atualização de
cadastro). O host estático precisa servir `index.html` em `/admin`
(`public/_redirects`).

## PWA

App instalável ("Adicionar à tela de início"). Requer **hospedagem estática no
root do domínio com HTTPS** (ex.: Cloudflare Pages) — não funciona via Apps
Script HTML Service (roda em iframe, sem escopo de service worker).

- **Service worker** (`vite-plugin-pwa`, `registerType: autoUpdate`): precacheia
  só o *app shell*; nova versão entra no próximo carregamento completo.
- **API nunca é cacheada** — `script.google.com` usa `NetworkOnly`. O estado é
  sempre recalculado no servidor; sem rede, cai na tela de Offline.
- O SW só ativa na **build** (`npm run build && npm run preview`), não em `dev`.

### Ícones

Em `public/` (gerados de `src/assets/logo-ser-amor.png`). A logo-fonte é 196px,
então os ícones ficam levemente suaves. Ao receber uma logo ≥512px ou SVG,
substitua o arquivo e regenere:

```bash
node scripts/generate-icons.mjs
```

## Estrutura

```
src/
├── types/                # api.ts (Contrato v1.2) · admin.ts (Fase 6)
├── lib/                  # phone, date, storage (one-tap), cn, zeroTrust, adminEnv
├── api/
│   ├── client.ts         # POST text/plain, timeout + retry; transporte `send` reusável
│   ├── mock.ts           # backend fake do MVP (máquina de estados In/Out)
│   ├── adminClient.ts    # endpoints da Fase 6; mock se VITE_ADMIN_MOCK / sem VITE_API_URL
│   └── adminMock.ts      # backend fake do /admin (dashboard, busca, ações, telefone)
├── state/useCheckinFlow  # máquina de estados → view (check-in)
├── components/           # Button, PhoneInput, Toggle, Screen, AppHeader, SummaryCard, icons
├── screens/              # check-in: T1 Phone · T3/T4 · T8 Success · L/E/O · terminais
├── admin/                # /admin (Fase 6): AdminApp, AdminShell, Visao/Servico/Cadastro, ui
└── main.tsx              # roteia /admin → AdminApp; resto → check-in
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
