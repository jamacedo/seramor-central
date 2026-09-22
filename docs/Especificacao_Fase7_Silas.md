# Especificação — Fase 7 (Integração Silas / Hermes)
## Sistema de Check-in de Voluntários · Igreja Ser Amor
**Versão:** 1.0 | **Escopo:** consultas de escala somente-leitura para o assistente Silas | **Base:** direcionamentos `00/01/02/03/04` (Silas, 08/09/2026), PRD v1.3 Apêndice A, Fase 6 (no ar) | **Data:** Set/2026

> Acrescenta ao Apps Script existente um **namespace de leitura** (`operation`),
> consumido por um plugin nativo do Hermes no profile `pastoral`. Não altera
> check-in, check-out, consolidação nem o painel `/admin`.
>
> **Onboarding/Notion está fora desta entrega** por decisão do projeto. A operação
> existe e responde `NOTION_NOT_CONFIGURED` — nunca uma lista vazia.

---

## 1. Decisões que divergem do direcionamento original

| Tema | Direcionamento | Decisão aqui | Motivo |
|---|---|---|---|
| Cadastro das áreas | Novo `04_CONFIGURACAO_AREAS.json` | **Derivar de `ADMIN_CONFIG.ORIGEM`** (Admin.gs) | O mapa Área→spreadsheetId já existe e é canônico; duplicar criaria precedência implícita. O JSON vira checklist de conferência dos IDs |
| Proxy autenticado | Avaliar reaproveitamento | **Não existe** — `POST /exec` direto | O front chama o Apps Script direto; criar um Worker só para o Silas é infra sem contrapartida |
| Extração de `lerEscalasAreas` do código atual | Refatorar a rotina de domingo | **Nada a extrair** | Nenhuma linha do backend lê `Escala <Mês>` hoje: check-in e admin vivem na consolidada. É código novo e isolado |
| Ferramentas na V1 do plugin | Três | **Duas** (`consultar_pendencias_escala`, `consultar_escala`) | Registrar uma tool que sempre erra ensina o Silas a oferecer o que não existe. A terceira entra com o Notion mapeado |
| Telefone "suspeito" | Categoria própria | **Não implementada** | Sem regra de validade acordada, viraria pendência falsa. Ficam `present`/`missing`/`error` |
| Homologação | Ambiente de teste | **Não existe: só produção** | Toda a regressão roda sobre matrizes sintéticas (função pura), sem abrir planilha real |
| Aba `Escala <Mês>` ausente | `MONTH_SHEET_NOT_FOUND` = fonte não verificada | **Categoria própria `not_scheduled`**, que não bloqueia a conclusão | Medição em produção (21/09/2026): 3 das 12 áreas não têm aba em setembro, e isso é estado normal. Com a regra estrita, **todo** relatório sairia `partial` e nunca permitiria "sem pendências". Flag `ABA_MES_AUSENTE_BLOQUEIA` restaura o estrito |

---

## 2. Arquivos

| Arquivo | Papel |
|---|---|
| `docs/Silas.gs` | **Novo.** Roteador, auth, leitura das abas mensais, regras, envelope, paginação. ~740 linhas, zero escrita |
| `docs/Silas_test.gs` | **Novo.** Testes puros + 2 smokes de produção somente-leitura |
| `docs/Code_otimizado.gs` | **Alterado (8 linhas).** Desvio no `doPost` antes do `switch (body.action)` |
| `docs/fixtures/silas/*.json` | **Novo.** 12 respostas reais do backend contra planilhas sintéticas — contrato executável para o agente do Hermes |

Nada no front (`src/`) muda: o Silas não tem tela.

---

## 3. Contrato

Vale o `03_CONTRATO_INTEGRACAO.md` integralmente. Resumo operacional:

**Requisição** — `POST` JSON para o `/exec` do deployment:

```json
{
  "api_version": "1",
  "request_id": "<uuid do cliente>",
  "client": "silas-voluntarios",
  "auth": { "token": "<SILAS_TOKEN>" },
  "operation": "voluntarios.escalas.pendencias",
  "params": { "data": "2026-09-27", "area": "acolhimento", "limite": 50 }
}
```

**Operações:** `voluntarios.escalas.pendencias`, `voluntarios.escalas.consultar`
(`visao`: `resumo` \| `completa`), `voluntarios.onboarding.pendencias` (indisponível).

**Áreas (`id`):** `transmissao · som · multimidia · louvor · logistica · foto_video ·
clubinho · central · acolhimento · iluminacao · ekoe · producao`.

**Cobertura:** `transmissao` exige só Noite; `foto_video` exige **pelo menos um**
período (vazio = **uma** falta); as outras dez exigem Manhã **e** Noite. O filtro
`periodo` é de apresentação: a cobertura é sempre avaliada com todos os períodos
exigidos, antes do filtro.

**Semântica que o plugin não pode recalcular:** `data.conclusion`,
`meta.all_clear_allowed`, `meta.read_complete`, `status`. `items: []` **não**
significa "tudo certo" — só `all_clear_allowed: true` autoriza essa frase.

**Nunca no payload:** telefone (só `phone_status`), `Observações`, stack trace,
ID de planilha, token.

---

## 4. Segurança

| Camada | Decisão |
|---|---|
| Credencial | Script Property **`SILAS_TOKEN`**, exclusiva. **Falha fechada**: sem a property, toda requisição é `UNAUTHENTICATED` (≠ `requireAdmin_`, que falha aberta) |
| Por que não reusar `ADMIN_TOKEN` | Ele viaja no bundle (`VITE_ADMIN_TOKEN`), servido no mesmo asset da rota pública `/` — não é segredo de servidor |
| Isolamento do roteador | O desvio por `operation` vem **antes** do `switch (body.action)`. Corpo com os dois campos é `INVALID_ARGUMENT`. O token do Silas não alcança `checkin`, `adminCheckin` ou `adminUpdatePhone` nem com parâmetros manipulados |
| Superfície | Allowlist de 3 operações. `params` rejeita chave não prevista (`url`, `spreadsheet_id`, `token`, `role`, `function_name`…) |
| Corpo | Limite de aplicação de 16 KiB, checado antes de abrir planilha |
| `GET` | `doGet` segue sendo health check e ignora parâmetros — não há caminho de consulta por URL |
| Texto das fontes | Conteúdo de célula é **dado**, nunca instrução. Nada do que vem da planilha muda endpoint, escopo ou destino |

**Pré-requisito de deploy — ✅ verificado (22/09/2026):** `ADMIN_TOKEN` está
setada em produção, então as três ações de escrita do admin já estão com gate.
A verificação importava porque `requireAdmin_` falha **aberta**: sem a property,
publicar uma versão nova manteria essas rotas acessíveis sem credencial.

---

## 5. Leitura e limites

- Fonte: aba **`Escala <Mês>`** da planilha de cada área, resolvida pelo mês da
  **data-alvo** (não pelo relógio). Como o nome da aba não tem ano, cada linha é
  filtrada pela **data completa**.
- Dois passes do mesmo range por área: `getValues` (datas) e `getDisplayValues`
  (telefone — fórmula que devolve vazio ou `#N/A` só aparece aqui).
- `try/catch` por área: uma planilha inacessível vira `SOURCE_UNAVAILABLE` e
  entra em `meta.unverified_sources`; as outras 11 continuam valendo.

**Três estados de fonte, deliberadamente distintos:**

| `source_status` | `coverage_status` | Efeito na conclusão | Quando |
|---|---|---|---|
| `ok` | avalia a regra | normal | Aba do mês lida |
| `no_month_sheet` | `not_scheduled` | **não bloqueia**; sai em `meta.no_schedule_sources` e em `warnings` | A área não escala neste mês — estado normal |
| `unavailable` / `timeout` | `unverified` | bloqueia: `read_complete: false`, `status: partial` | Permissão, cota, erro de leitura ou estouro de orçamento |

Área **sem aba do mês** ≠ área **com aba vazia**. A segunda gera pendência de
cobertura; a primeira não gera nada, porque não sabemos nada sobre a escala dela.
Ela continua **nomeada** na resposta: o relatório cita as áreas sem escala no
mês sem chamá-las de falha nem de pendência.

- **Orçamento de tempo:** `SILAS_CONFIG.DEADLINE_MS = 40000`, calibrado por
  medição (21/09/2026: **23,2s** para as 12 áreas, 9 com aba do mês). O pior
  caso é cold start (~8s) + orçamento + a última área iniciada + serialização,
  que cabe nos 60s do plugin. Ao estourar, as áreas restantes viram
  `UPSTREAM_TIMEOUT` não verificado e a resposta sai `status: partial`.
  Remedir com `test_silas_smoke_producao_todas` se as planilhas crescerem.
- Sem cache na V1. Se a medição exigir, o cache precisa carregar o horário da
  leitura no `meta` — relatório programado não pode fingir atualidade.
- Data omitida: primeiro domingo **estritamente posterior** a hoje em
  `America/Sao_Paulo`. Para "hoje", o plugin envia a data explícita.

---

## 6. Testes

Rodar `test_silas_todos` no editor do Apps Script (Executar → log de Execuções).
São funções puras sobre matrizes sintéticas — **não abrem planilha**.

Cobrem os cenários obrigatórios do direcionamento (doc 1 §10), menos os de Notion:
Transmissão só à noite / só de manhã · Foto e Vídeo em um período / vazio · Som só
de manhã · `Manhã, Noite` numa linha · mesma pessoa em duas linhas · telefone
vazio / fórmula vazia / `#N/A` / manual · data de outro ano na mesma aba · período
ilegível · virada de mês e de ano · corpo híbrido `action`+`operation` · token
inválido · parâmetros administrativos · paginação e `STALE_CURSOR`.

Os smokes `test_silas_smoke_producao` (uma área) e
`test_silas_smoke_producao_todas` (12) são **somente leitura** e existem para
medir tempo. Rodar fora da janela de culto.

---

## 7. Implantação e rollback

1. Copiar `Silas.gs` e `Silas_test.gs` para o projeto Apps Script; aplicar o
   desvio do `doPost` (`Code_otimizado.gs`).
2. Criar a Script Property **`SILAS_TOKEN`** com um segredo novo
   (`openssl rand -hex 32`) — não reaproveitar credencial existente.
   Propriedade é lida em tempo de execução: vale na requisição seguinte, sem
   reimplantar. (`ADMIN_TOKEN`, §4, já verificado.)
3. `test_silas_todos` verde.
4. `test_silas_smoke_producao_todas` → ajustar `DEADLINE_MS` se necessário.
5. **Implantar → Gerenciar implantações → editar a existente → Nova versão.**
   (NÃO "Nova implantação": mudaria a URL do front.)
6. Entregar ao responsável pelo Hermes, por canal seguro: URL do `/exec` e o
   `SILAS_TOKEN`. Nunca em chat, ticket ou log.

**Rollback:** apagar a Script Property `SILAS_TOKEN` desativa a integração
imediatamente (falha fechada), sem redeploy e sem afetar check-in ou admin.
Para reverter o código, republicar a versão anterior pelo mesmo fluxo.

---

## 8. Handoff para o agente do Hermes

O backend é o dono das regras. O plugin **valida e transporta** — não recalcula
cobertura, não deduz conclusão, não inventa totais.

**Fixtures:** `docs/fixtures/silas/` (12 arquivos, dados fictícios). São saída
real deste backend; use-as como transporte simulado nos testes do plugin.

| Fixture | Serve para testar |
|---|---|
| `01_…sem_pendencias` | `all_clear_allowed: true` → única frase de "tudo certo" permitida |
| `02_…com_pendencias` | Leitura completa com 5 pendências de 3 tipos |
| `03_…parcial` | `status: partial` com pendências, uma fonte **não verificada** (Produção) e uma **sem aba do mês** (Ekoe) — três coisas diferentes na mesma resposta |
| `04_…parcial_inconclusiva` | `items: []` com `conclusion: inconclusive` → **não** dizer "tudo certo" |
| `05_consultar_resumo` | `pagination: null`, sem detalhes |
| `06/07_…completa_pagina1/2` | `has_more`, `next_cursor`, continuação |
| `08_…uma_area` | Escopo de 1 área → não afirmar nada sobre as outras 11 |
| `09_erro_onboarding…` | Capacidade indisponível |
| `10_erro_nao_autenticado` | Credencial recusada |
| `11_erro_argumento_invalido` | Data que não é domingo |
| `12_erro_cursor_expirado` | `STALE_CURSOR` → recomeçar a listagem uma vez |
| `13_…areas_sem_aba_do_mes` | **O caso real de produção:** 3 áreas sem aba do mês, 9 cobertas → `complete` + `all_clear_allowed: true`, com as 3 nomeadas em `meta.no_schedule_sources`. O relatório deve dizer "sem pendências" **e** citar as três |

**Regras do cliente HTTP** (detalhe em `02_DIRECIONAMENTO_PLUGIN_HERMES.md` §6):
redirect só para `script.google.com` / `script.googleusercontent.com`, poucos
saltos, **sem reenviar o corpo** (carrega o token) após 302/303, rejeitar 307/308
entre origens, TLS verificado, timeout ~60s, 1 retry só para falha transitória.
HTTP 200 com HTML é `UPSTREAM_INVALID_RESPONSE`, não sucesso. Validar que
`operation` e `request_id` da resposta batem com os enviados.

**Ordem sugerida:** recon da versão instalada do Hermes → plugin contra as
fixtures → apontar para a API real → consultas manuais no Telegram → trecho do
SOUL → jobs de sexta e sábado **criados pausados**, com destino
`telegram:<chat do admin>` explícito e fuso `America/Sao_Paulo` conferido.

---

## 9. Pendências

| Item | Tipo | Observação |
|---|---|---|
| ~~Medição das 12 áreas~~ | ✅ Feito | 23,2s em 21/09/2026 → `DEADLINE_MS = 40000`. Remedir se as planilhas crescerem |
| Conferência dos 12 spreadsheetIds | Config | O `04_CONFIGURACAO_AREAS.json` bate com `ADMIN_CONFIG.ORIGEM`; validar título de cada arquivo antes de expor |
| ~~`ADMIN_TOKEN` em produção~~ | ✅ Verificado | 22/09/2026: setada; as rotas de escrita do admin estão com gate |
| Onboarding/Notion | Escopo | Fora. Mapear fonte, propriedades, fases e estados terminais antes de habilitar |
| Cadastro de responsáveis por área | Futuro | `schedule_owner` não é usado na V1; prepara cobrança futura, que não está autorizada |
