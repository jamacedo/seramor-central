# Deploy — Cloudflare Workers (static assets) · Runbook
## Sistema de Check-in de Voluntários · Igreja Ser Amor
**Tipo:** Runbook de deploy/operação | **Stack:** SPA estática (React+Vite+PWA) | **Data:** Jun/2026

Comportamento esperado ao subir código para produção no **Cloudflare Workers** (com
**static assets**, via *Workers Builds* — repo conectado, `main` = branch de produção)
e o checklist de go-live.

> O deploy usa **Workers + Assets** (Worker `seramor-central`), **não** Pages clássico
> (confirmado pelo log: `wrangler deploy` → `.../workers/scripts/seramor-central/...`).
> Isso muda o **fallback de SPA** (§5).

> ⚠️ Este projeto tem 3 armadilhas que **não** se resolvem só commitando: as
> **variáveis de ambiente** (não versionadas), a **proteção do `/admin`** (Zero
> Trust, configurado fora do código) e o **cache do service worker** (atualização
> com 1 reload de atraso). Leia as §§ 2–4.

---

## 1. O pipeline

- **Gatilho:** push na `main` → *Workers Builds* roda o build e `wrangler deploy` →
  publica uma nova **versão** do Worker no domínio configurado.
- **Config versionada (`wrangler.toml` na raiz):** declara o Worker e os assets:
  ```toml
  name = "seramor-central"
  compatibility_date = "2025-06-01"
  [assets]
  directory = "./dist"
  not_found_handling = "single-page-application"   # fallback de SPA (ver §5)
  ```
- **Build settings (dashboard):**
  - Build command: `npm run build` (= `tsc -b && vite build`)
  - Deploy command: `wrangler deploy` (lê o `wrangler.toml` acima)
  - Node: **fixado em `.nvmrc` (`22.16.0`)** — o Workers Builds respeita o `.nvmrc`
    (ou a env `NODE_VERSION`).
- **Branches que não são `main`** (PRs) geram **preview deployments** com URL própria —
  ver §4 (precisam ser cobertas pelo Zero Trust).

---

## 2. ⚠️ Variáveis de ambiente — NÃO sobem no commit

O `.gitignore` ignora `.env` e `.env.*` (só `.env.example` é versionado). O Vite
**inlina** as `VITE_*` **no momento do build**, então o que vale em produção é o que
estiver configurado em **Pages → Settings → Environment variables → Production** —
não o seu `.env` local.

| Variável | Produção (hoje) | Efeito se faltar |
|----------|------------------|------------------|
| `VITE_API_URL` | **Apps Script de PRODUÇÃO** (`.../exec`) | Vazio → o check-in (`/`) usa o **mock** (`src/api/mock.ts`) → **check-in falso em produção** 🔴 |
| `VITE_ADMIN_MOCK` | **`1`** (enquanto não há backend admin) | Sem o flag + `VITE_API_URL` setado → `/admin` tenta os `action`s admin no Apps Script, que **não existem** → **/admin quebrado** 🔴 |

**Matriz de comportamento:**

| Env no Pages | Check-in (`/`) | Painel (`/admin`) |
|---|---|---|
| Nada setado | mock (falso) 🔴 | mock (demo) |
| `VITE_API_URL=<prod>`, sem `VITE_ADMIN_MOCK` | backend real ✅ | **quebrado** 🔴 |
| `VITE_API_URL=<prod>` + `VITE_ADMIN_MOCK=1` | backend real ✅ | mock (demo) — ver nota |

→ Estado coerente **hoje**: `VITE_API_URL` = Apps Script de produção **+**
`VITE_ADMIN_MOCK=1`. Confirme que o Web App de produção aponta para a **planilha de
produção** (`10lmOfSE4O8CnJOmyZ96i0f2k26uDxrV5QCEP9DlurRA`), não a de homolog
(`1nxhXn6_39j9...`).

> **Nota — `VITE_ADMIN_MOCK=1` acopla dados E identidade.** Com o flag ligado, o
> `/admin` usa o mock *e* a identidade vira fixa (`admin@seramor.com.br`), e o "Sair"
> vai para `/` em vez do logout do Zero Trust. Ou seja: **`/admin` em produção com o
> flag ligado é uma demo** (a auditoria/operador também é fake). Não dá, com o toggle
> atual, ter "identidade real do Zero Trust + dados mockados". Quando o backend admin
> existir, **desligue o flag** (remova ou `=0`).

---

## 3. PWA / service worker — atualização com 1 reload de atraso

`vite-plugin-pwa` com `registerType: autoUpdate`. A cada deploy o precache muda
(assets com hash). Para quem já visitou/instalou:

- na **primeira** visita pós-deploy, o SW ainda serve o **app shell em cache** e baixa
  a nova versão em background;
- a nova versão entra **no reload seguinte**.

→ **"Commitou → todos veem na hora" é falso** para instalações existentes (há 1
carregamento de atraso). Visitante novo já pega a versão nova.

- A **API** (`script.google.com`) é `NetworkOnly` — nunca cacheada; sem risco de
  estado velho do backend.
- **Sintoma clássico:** `/admin` (ou uma mudança) "não aparece" → SW antigo servindo o
  shell anterior. **Remédio:** hard-reload (Cmd/Ctrl+Shift+R) ou, no console:
  ```js
  navigator.serviceWorker?.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
  caches?.keys().then(ks => ks.forEach(k => caches.delete(k)))
  ```
  e recarregar.

---

## 4. `/admin` e Cloudflare Zero Trust — o commit **não** protege a rota

Commitar código **não configura** o Zero Trust. A proteção do `/admin` é uma **Access
Application/Policy** no dashboard (Zero Trust → Access → Applications), separada do deploy.

- Se a policy **não** cobrir o path `/admin`, ele fica **público** após o deploy (e,
  com o mock, qualquer um vê a demo). 🔴
- Os endpoints `/cdn-cgi/access/get-identity` (identidade do operador) e
  `/cdn-cgi/access/logout` (Sair) **só funcionam atrás do Access**.
- **Preview deployments** (`*.pages.dev`): se a policy só cobre o domínio custom, o
  `/admin` das previews pode ficar **exposto**. Cubra as previews na policy (incluir o
  hostname `*.pages.dev` do projeto) **ou** desabilite preview deployments.
- Lembrete do PRD: **compartilhamento/permissão das planilhas é manual** — o app não mexe.

---

## 5. Roteamento SPA — `not_found_handling`, NÃO `_redirects`

No **Workers Assets**, o fallback de SPA é a opção do `wrangler.toml`:

```toml
[assets]
not_found_handling = "single-page-application"
```

Isso serve o `index.html` (200) para qualquer rota **sem arquivo** → `/admin` e deep
links resolvem no client (`src/main.tsx`). **Sem isso, `/admin` daria 404.**

> 🐞 **Não reintroduzir `_redirects` com `/* /index.html 200`.** O Workers Assets
> **rejeita o build** com *"Invalid _redirects configuration: Infinite loop detected"*
> (o destino `/index.html` casa com `/*`). Isso quebrou um deploy em jun/2026. O
> `_redirects` `/* → /index.html 200` é idioma do **Pages clássico** — aqui usamos
> `not_found_handling`. (Um `_redirects` só com redirects "de verdade", sem o
> catch-all de SPA, seria aceito, mas não precisamos dele.)

---

## 6. Checklist de go-live (deploy via `main`)

1. **Env vars (Production):** `VITE_API_URL=<Apps Script PROD /exec>` + `VITE_ADMIN_MOCK=1`.
2. Web App de produção do Apps Script aponta para a **planilha de produção**.
3. **Access policy (Zero Trust)** cobrindo `/admin` no **domínio de produção** e nas
   **previews `*.pages.dev`**.
4. Build/deploy: `npm run build` → `dist`; `wrangler.toml` com
   `[assets] not_found_handling="single-page-application"`; **sem** `_redirects`
   catch-all (§5). Node fixado via `.nvmrc` (`22.16.0`).
5. Comunicar que instalações PWA existentes atualizam **no reload seguinte**.
6. **Sanidade pós-deploy:**
   - `/` resolve um telefone **real** (não cai no mock) e faz check-in/out no backend.
   - `/admin` **exige login do Zero Trust** (abrir anônimo deve barrar).
   - Deep link direto em `/admin` carrega (não 404).

---

## 7. Quando o backend admin existir (Fase 6 “real”)

1. Implementar os `action`s no Apps Script: `adminDashboard`, `adminSearch`,
   `adminCheckin`, `adminCheckout`, `adminUpdatePhone` + auditoria em `Observações`
   (ver `docs/Especificacao_Fase6_Admin.md` §5).
2. **Desligar `VITE_ADMIN_MOCK`** no Pages (remover ou `=0`) → `/admin` passa a usar a
   identidade real do Zero Trust e os dados reais.
3. Revisar a dívida de segurança: os endpoints admin do Apps Script ficam **públicos**
   (Zero Trust protege só o front). Plano: token compartilhado no header validado pelo
   Apps Script **ou** mover os `action`s admin para um Worker atrás de Zero Trust
   (ver Especificação Fase 6 §2.2 / §7).

---

*Runbook de deploy no Cloudflare Pages. Acompanha o README e a
`docs/Especificacao_Fase6_Admin.md`. Atualize ao mudar env vars, hosting ou a
configuração do Zero Trust.*
