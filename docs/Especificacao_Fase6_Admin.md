# Especificação + Wireframes — Fase 6 (Visão Central / Admin)
## Sistema de Check-in de Voluntários · Igreja Ser Amor
**Versão:** 0.3 (enxuta + addendum de implementação) | **Escopo:** Painel `/admin` — 3 frentes | **Base:** PRD v1.3, Especificação Fases Futuras §3, Contrato v1.2, Addendum Jun/2026 | **Data:** Jun/2026

> Versão **enxuta e acionável** da Fase 6. Cobre só o que foi priorizado:
> **(1) Visão global**, **(2) Check-in/out manual por nome** e **(3) Atualização de telefone**.
> Demais itens da Fase 6 do doc de Fases Futuras (override de escala, CRUD completo
> de voluntários) ficam **fora deste recorte**. Marcações `[A DEFINIR]` seguem o
> estilo dos specs anteriores.
>
> 🛠️ **A §8 (Addendum de implementação · front)** registra o que foi construído e
> **prevalece** sobre as §§ anteriores nos pontos indicados (padrão do MVP).

---

## 1. Visão Geral

| Item | Decisão |
|------|---------|
| **Persona** | Administrador da Igreja (secretaria/coordenação) — visão global e resolução de exceções |
| **Onde mora** | **Mesmo projeto** do app de check-in (React + Vite + TS + Tailwind), em rota `/admin` |
| **Backend** | **Mesmo Apps Script** do MVP, com novos `action`s; mesmo spreadsheet |
| **Autenticação** | **Cloudflare Zero Trust** na rota `/admin` — o app **não** implementa login |
| **Marca / título** | **"Base Voluntários"** no header (não "Ser Amor · Admin") |
| **Plataforma de uso** | Mobile-first, mas o Dashboard adapta para tablet/desktop (admin costuma usar tela maior) |

**Princípio:** reaproveitar tudo do MVP (camada de API trocável, componentes, tokens
de marca). O `/admin` é um **segundo entrypoint** no mesmo bundle, não um app novo.

---

## 2. Acesso e Segurança

### 2.1 Cloudflare Zero Trust (frontend)
- A rota `/admin` (e o asset que a serve) fica atrás de uma **policy do Cloudflare Access**:
  só e-mails do grupo **Administradores** entram. Sem allowlist no código.
- O app lê a identidade autenticada via **`/cdn-cgi/access/get-identity`** (endpoint que
  o Cloudflare expõe no domínio protegido) para saber **quem** é o operador — usado na
  auditoria (`operador` = e-mail).
- Logout/identidade são responsabilidade do Zero Trust; o app só consome a identidade.

### 2.2 Backend (dívida de segurança aceita nesta fase)
> **Decisão consciente:** os `action`s de admin rodam no **mesmo Apps Script `/exec`**, que
> permanece **público** (Zero Trust protege só o front estático). Nesta fase **aceitamos o
> risco** — obscuridade da `action` + porte/baixo risco da igreja.

- O `operador` (e-mail) vai **no corpo** da requisição, preenchido pelo front a partir do
  `get-identity`. O backend **confia** nesse valor (não há verificação server-side da identidade).
- **[A DEFINIR — pós-Fase 6]** Fechar o buraco com **token compartilhado no header** validado
  pelo Apps Script, ou mover os `action`s de admin para um **Worker atrás de Zero Trust**
  (mesma identidade do front). Registrado em §7.
- Mantém-se a regra do PRD: **alterações de permissão/compartilhamento de planilha não são
  feitas pelo app** — são manuais.

---

## 3. Funcionalidades e User Stories

| # | Funcionalidade | User Story |
|---|----------------|-----------|
| **F6-A** | **Visão global** (aba **Visão**) | **US-A2 (MUST):** Como admin, quero ver o status de **todas as áreas** num só painel, para garantir a operação do culto. |
| **F6-B** | **Check-in/out manual por nome** (aba **Serviço**) | **US-A1 (MUST):** Como admin, quero buscar um escalado **pelo nome** e registrar entrada/saída por ele (plano B: celular sem bateria/quebrado), com **auditoria**. |
| **F6-C** | **Atualização de cadastro/telefone** (contextual, a partir de uma pessoa) | **US-A3' (SHOULD):** Como admin, quero **corrigir o telefone** de um voluntário (cadastro desatualizado/ausente), para que ele consiga usar o check-in. |

### Critérios de aceite

- **US-A2:** DADO `/admin` autenticado, QUANDO o painel carrega, ENTÃO mostra **todas as áreas**
  com contadores (Pendente · Em serviço · Concluído) e % de comparecimento do dia; atualiza por
  **polling leve** (intervalo em §6). Filtro por **turno** e por **área**.
- **US-A1:** DADO o admin busca por nome entre os **escalados de hoje**, QUANDO seleciona a pessoa,
  ENTÃO o sistema mostra o estado dela (Pendente / Em serviço / Concluído) e oferece a ação cabível
  (**Check-in** ou **Check-out**); ao confirmar, grava na **linha existente** (chave `Telefone+Data+Área+Turno`)
  com **marcação de manual + operador** na coluna `Observações`.
- **US-A3':** DADO o admin abre o cadastro de um voluntário, QUANDO informa o novo telefone (11 dígitos válidos),
  ENTÃO o backend grava o telefone **na planilha de área (origem) e na `Base Voluntarios` (compilada)** — efeito
  imediato no app —, registrando operador e timestamp.

> **Escopo da busca manual:** **apenas escalados de hoje** (todas as áreas). Substituto / quem não está
> na escala continua coberto pela **US-10** (presença fora da escala) ou por correção de cadastro — fora deste recorte.

---

## 4. Wireframes (textuais)

> Convenções idênticas às do MVP (`Wireframes_Telas_MVP.md`). Viewport de referência **390px**;
> o Dashboard expande em ≥768px (grid de cards). Botões de toque ≥44px, contraste WCAG AA.

**Legenda**
```
┌────────┐ moldura = viewport (~390px)   ▮ = aba ativa     ⟳ = atualizando / selo
▓▓▓ = botão primário   ░ = ação secundária / link   [ campo ▾ ] = select
[ 🔍 ____ ] = busca    ▸ = item tocável    ▰▰▱ = barra de progresso (%)
status:  ⬜ Pendente (In=FALSE)  ·  🟡 Em serviço (In=TRUE,Out=FALSE)  ·  ✅ Concluído (Out=TRUE)
```

### Shell do `/admin` (comum às telas)

```
┌──────────────────────────────┐
│  Base Voluntários       ⟳12:04│  HEADER 56px — marca + selo "atualizado às"
│  admin@seramor.com.br      ⌄   │  identidade (Zero Trust) · ⌄ = sair (ZT)
│ ═════════════════════════════ │
│                              │
│   CONTEÚDO DA SEÇÃO           │  rola se preciso
│                              │
│ ───────────────────────────── │
│  [ ▮ Visão ]    [  Serviço  ] │  TAB BAR 56px fixa (▮ = aba ativa)
└──────────────────────────────┘
```

| Elemento | Especificação |
|----------|---------------|
| Header | Marca **"Base Voluntários"** + horário da última atualização (selo ⟳). 56px, fixo |
| Identidade | E-mail do operador (lido do `get-identity`), 12px. `⌄` aciona o logout do **Zero Trust** (não há sessão no app) |
| Navegação | **2 abas** na **barra inferior** (mobile) / topo (desktop): **Visão** (F6-A) · **Serviço** (F6-B), com `▮` na ativa. A **Atualização de cadastro/telefone** (F6-C) **não é aba fixa** — abre **ao selecionar uma pessoa** (também alcançável por busca dentro de Serviço) |

---

### F6-A · Visão global (Dashboard) — US-A2

```
┌──────────────────────────────┐
│  Base Voluntários       ⟳12:04│
│ ───────────────────────────── │
│  Hoje · 08/06 (qui)   [Manhã ▾]│  data + filtro de turno
│  Área: [ Todas ▾ ]      ⟳ 30s │  filtro de área · auto-refresh
│ ───────────────────────────── │
│ ┌──────── RESUMO ───────────┐ │  agregado das áreas filtradas
│ │ 84 escalados     75% ▰▰▰▱ │ │  total + barra de comparecimento
│ │ ⬜ 21    🟡 12    ✅ 51    │ │  pendente · em serviço · concluído
│ └───────────────────────────┘ │
│ ───────────────────────────── │
│  ÁREAS              ↑ menor %  │  ordenação default
│ ┌───────────────────────────┐ │
│ │ Louvor           11/14  79%│ │  presentes/escalados + %
│ │ ▰▰▰▰▰▰▰▱▱  ⬜3 🟡2 ✅9   ▸│ │  barra + breakdown · ▸ abre Serviço
│ ├───────────────────────────┤ │
│ │ Acolhimento       6/10  60%│ │
│ │ ▰▰▰▰▰▱▱▱▱  ⬜4 🟡1 ✅5   ▸│ │
│ ├───────────────────────────┤ │
│ │ Clubinho          8/8 100%│ │
│ │ ▰▰▰▰▰▰▰▰▰  ⬜0 🟡0 ✅8   ▸│ │
│ └───────────────────────────┘ │
│             ⋮ (11 áreas)       │
│ ───────────────────────────── │
│  [ ▮ Visão ]    [  Serviço  ] │
└──────────────────────────────┘
```

```
  Carregando (1ª carga)        Vazio (turno sem escala)
┌──────────────────────┐     ┌──────────────────────┐
│  ⟳ Carregando áreas… │     │          🗓           │
│  ▱▱▱▱▱  (skeleton)   │     │  Nenhuma escala para  │
│  ▱▱▱▱▱                │     │  este turno.          │
└──────────────────────┘     └──────────────────────┘
```

**Ao tocar num card de área (▸):** abre a aba **Serviço** (F6-B) **já filtrada por aquela área**,
listando os voluntários escalados (nome, função, turno, selo de status) prontos para ação
(check-in/out) ou atualização de cadastro. O Dashboard em si **não** abre lista própria — ele
sempre encaminha para Serviço, evitando duplicar a lista de pessoas em duas telas.

**API:** `adminDashboard` → `resumo` (agregado) + `areas[]`; re-chamado por **polling 20–30s** (pausa com a aba em background).

| Elemento | Especificação |
|----------|---------------|
| Filtro de turno | `Todas` · `Manhã` · `Noite`. Default: turno inferido pela hora atual (janelas do contrato) |
| Filtro de área | `Todas` + enum de 11 áreas |
| Card de resumo | Agregado de **todas as áreas** filtradas: Escalados, ⬜/🟡/✅ e % comparecimento |
| Card por área | `presentes/escalados`, %, breakdown ⬜/🟡/✅. **Ordenação default:** menor % primeiro (puxa atenção para áreas com falta). **Toque → aba Serviço filtrada pela área** |
| Estado vazio | "Nenhuma escala para este turno." |
| Atualização | **Polling leve** (§6); selo ⟳ no header com horário; sem recarregar a página |

**Status derivado da máquina de estados:** ⬜ Pendente = `In=FALSE` · 🟡 Em serviço = `In=TRUE,Out=FALSE` · ✅ Concluído = `Out=TRUE`.

---

### F6-B · Serviço — Check-in/out manual por nome — US-A1

```
   LISTA (busca / filtro)               AÇÃO (painel da pessoa selecionada)
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  Base Voluntários       ⟳12:05│     │  ◂ Voltar                     │
│ ───────────────────────────── │     │ ───────────────────────────── │
│  Voluntários escalados        │     │  Pablo Alcântara              │  H2
│  [ 🔍 pablo________________ ] │     │  Louvor · Manhã · Vocal       │
│  [ Área ▾ ]  [ Turno ▾ ]      │     │  📞 (11) 9 9999-8888       ✎  │  ✎ → F6-C
│ ───────────────────────────── │     │ ───────────────────────────── │
│  2 resultados                 │     │  ┌── varia conforme estado ─┐ │
│ ┌───────────────────────────┐ │ ──▶ │  │ ⬜ Pendente               │ │
│ │ Pablo Alcântara        ⬜ │▸│     │  │  ▓▓ Confirmar Check-in ▓▓ │ │  verde
│ │ Louvor · Manhã · Vocal    │ │     │  │ ─────────────────────────│ │
│ ├───────────────────────────┤ │     │  │ 🟡 Em serviço · 08:32     │ │
│ │ Pablo Souza            🟡 │▸│     │  │  ▓▓ Confirmar Check-out ▓▓│ │  azul
│ │ Som · Noite · Técnico     │ │     │  │ ─────────────────────────│ │
│ └───────────────────────────┘ │     │  │ ✅ 08:32 → 11:05 (2h33)   │ │
│ ───────────────────────────── │     │  │  sem ação (só horários)   │ │
│  [  Visão  ]    [ ▮ Serviço ] │     │  └───────────────────────────┘ │
└──────────────────────────────┘     │  ░ ✎ Atualizar cadastro ░     │
                                      └──────────────────────────────┘
   Vazio: "Ninguém escalado hoje      O painel mostra UM dos 3 blocos
   bate com a busca."                 conforme o estado da pessoa.
```

| Elemento | Especificação |
|----------|---------------|
| Campo de busca | Por **nome** (substring, sem acento/caixa). Debounce; mín. 2 caracteres |
| Filtros | **Área** e **Turno** (mesmos enums). Combinam com a busca. **Pré-filtro por área** quando aberto a partir de um card do Dashboard (F6-A) |
| Escopo | **Somente escalados de hoje** (todas as áreas). Sem resultado → "Ninguém escalado hoje bate com a busca." |
| Item de resultado | Nome + Área · Turno · Função + selo de status |
| Tela de ação | Nome, escala, status, telefone (leitura), **um** botão conforme o estado **e** link **✎ Atualizar cadastro** |
| Botão primário | ⬜→ **Confirmar Check-in** (verde) · 🟡→ **Confirmar Check-out** (azul) · ✅→ sem botão, exibe Entrada/Saída |
| Ação secundária | **✎ Atualizar cadastro** → abre **F6-C** já apontado para esta pessoa (corrigir/incluir telefone). Disponível em **qualquer** estado |
| Marcação manual | Sempre que o admin registra, grava **flag de manual + `operador`** em `Observações` (ver §5.4) |
| Confirmação | Após gravar: toast "Check-in de Pablo registrado por você" e volta aos resultados (atualizando o selo) |

**Atalho (vindo de F6-A):** ao tocar num card de área no Dashboard, Serviço abre **já filtrado por aquela área** (lista de escalados pronta).

**API:** `adminSearch` (lista de hoje, filtra por nome/área/turno) · `adminCheckin` / `adminCheckout` na ação (enviam `operador`; gravam marcação de manual). `✎` abre **F6-C**.

---

### F6-C · Atualização de cadastro/telefone — US-A3'

> **Não é aba fixa.** Abre **ao selecionar uma pessoa** — via **✎ Atualizar cadastro** na tela de
> ação de Serviço (F6-B). Mantém também uma **busca própria na base** (para corrigir o cadastro de
> quem **não** está escalado hoje, fora do escopo da lista de Serviço).

```
   EDIÇÃO (de uma pessoa)              SUCESSO
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  ◂ Voltar                     │   │             ✓                 │
│ ───────────────────────────── │   │                              │
│  Maria Oliveira               │   │  Telefone atualizado!         │
│  Louvor · Vocal               │   │                              │
│ ───────────────────────────── │   │  Maria Oliveira               │
│  Telefone atual               │   │  (11) 99999-8888              │
│  (11) 9 8888-7777   (ou —)    │   │  gravado na área + base       │
│                              │   │ ───────────────────────────── │
│  Novo telefone                │   │  ▓▓▓ Concluir ▓▓▓             │
│  [ (11) 99999-8888________ ]  │   └──────────────────────────────┘
│  ⓘ Grava na planilha da área  │
│    e na base · efeito imediato│    Conflito (telefone já em uso):
│ ───────────────────────────── │    ⚠ "Este telefone já está em
│  ▓▓▓ Salvar telefone ▓▓▓      │      uso por outro voluntário."
└──────────────────────────────┘      (DUPLICATE_PHONE · não grava)

  Fallback — busca própria na base (corrigir quem NÃO está escalado hoje):
  [ 🔍 maria ] → ▸ Maria Oliveira (Louvor · Vocal) | ▸ Maria Santos (Acolhimento)
  → abre a tela de EDIÇÃO acima para a pessoa escolhida.
```

| Elemento | Especificação |
|----------|---------------|
| Entrada principal | **✎ Atualizar cadastro** a partir da pessoa em Serviço (F6-B) — já vem com nome/área |
| Busca (fallback) | Por **nome** na **`Base Voluntarios`** (toda a base, não só hoje). Mostra Área · Função para desambiguar homônimos |
| Telefone atual | Exibido (ou "—" se ausente). Read-only |
| Novo telefone | Input `inputmode="numeric"`, máscara `(XX) XXXXX-XXXX`; valida 11 dígitos; normaliza (descarta `55`) |
| Gravação | **Origem + compilada:** o backend localiza o voluntário na aba `Voluntários` da **planilha da área** e atualiza, **e** atualiza a linha em **`Base Voluntarios`** (efeito imediato no `/resolve`) |
| Confirmação | Toast "Telefone de Maria atualizado"; mostra o novo número |
| Conflito | Se o telefone já existir em outro cadastro ativo → aviso `DUPLICATE_PHONE` (ver §5.4) e não grava |
| Auditoria | Registra operador + timestamp (coluna `Observações` da base ou log — §5.4) |

> **Por que origem + compilada:** a `Base Voluntarios` é recompilada pelo App Script a partir das
> abas de área; gravar só na compilada seria sobrescrito. Gravar na origem garante persistência;
> gravar também na compilada dá efeito imediato sem esperar a próxima consolidação.

**API:** `adminUpdatePhone` → grava **origem + compilada** (`gravado: ["origem","base"]`). Erros: `DUPLICATE_PHONE`, `VOLUNTEER_NOT_FOUND`, `ORIGIN_NOT_FOUND`.

---

### Estados transversais (reaproveitados do MVP)
- **L (loading):** spinner por seção; selo ⟳ no header durante polling.
- **E (erro):** banner amigável, nunca expõe código (ver catálogo §5.4). Botão "Tentar de novo".
- **O (offline):** mesma tela offline do MVP — admin depende de rede (sem cache da API).
- **Vazio:** copy específica por seção (acima).

---

## 5. Extensão do Contrato de API

> Mesmo envelope do Contrato v1.2 (`{ ok, state?, data, error }`), mesmo `POST` com
> `text/plain` p/ Apps Script, HTTP sempre 200. Novos `action`s abaixo. Todos recebem
> **`operador`** (e-mail do Zero Trust, via `get-identity`) — confiado pelo backend (§2.2).

### 5.1 `POST adminDashboard` — Visão global (US-A2)
**Request**
```json
{ "action": "adminDashboard", "operador": "admin@seramor.com.br", "turno": "Manhã", "data": "08/06/2026" }
```
> `turno` opcional (`Manhã` | `Noite` | omitido = todos).
> `data` opcional **`DD/MM/YYYY`** — data de referência escolhida no header (seletor de
> calendário, §8.7). **Omitido = hoje** (servidor). Permite ao admin revisar outras datas.

**Sucesso**
```json
{ "ok": true,
  "data": {
    "data": "08/06/2026",
    "resumo": { "escalados": 84, "pendentes": 21, "emServico": 12, "concluidos": 51, "comparecimento": 0.75 },
    "areas": [
      { "area": "Louvor", "escalados": 14, "pendentes": 3, "emServico": 2, "concluidos": 9, "comparecimento": 0.79 },
      { "area": "Acolhimento", "escalados": 10, "pendentes": 4, "emServico": 1, "concluidos": 5, "comparecimento": 0.60 }
    ]
  },
  "error": null }
```

### 5.2 `POST adminSearch` — Busca de escalados (US-A1)
**Request**
```json
{ "action": "adminSearch", "operador": "admin@seramor.com.br",
  "nome": "pablo", "area": "Louvor", "turno": "Manhã", "data": "08/06/2026" }
```
> `nome` **opcional** — `≥2 chars` filtra por nome; **vazio lista todos** do filtro (ver §8.4).
> `area`/`turno` opcionais (filtros). `data` opcional `DD/MM/YYYY`, **omitido = hoje** (§8.7).

**Sucesso** — lista de linhas da escala da data de referência que casam:
```json
{ "ok": true,
  "data": { "itens": [
    { "nome": "Pablo Alcântara", "telefone": "11999998888",
      "escala": { "telefone": "11999998888", "data": "08/06/2026", "area": "Louvor", "turno": "Manhã", "funcao": "Vocal" },
      "estado": "CAN_CHECKIN" },
    { "nome": "Pablo Souza", "telefone": "11977776666",
      "escala": { "telefone": "11977776666", "data": "08/06/2026", "area": "Som", "turno": "Noite", "funcao": "Técnico" },
      "estado": "IN_SERVICE", "checkinAt": "08/06/2026 18:40" }
  ] },
  "error": null }
```
> `estado` é o mesmo `CheckinState` do MVP (`CAN_CHECKIN`/`IN_SERVICE`/`DONE`). O cliente escolhe a ação.

### 5.3 `POST adminCheckin` / `POST adminCheckout` — Registro manual (US-A1)
Reutilizam a mesma gravação do MVP (`/checkin`/`/checkout`) na chave `Telefone+Data+Área+Turno`,
**acrescentando** `operador` e marcação de manual.

**Request**
```json
{ "action": "adminCheckin", "operador": "admin@seramor.com.br",
  "telefone": "11999998888", "data": "08/06/2026", "area": "Louvor", "turno": "Manhã" }
```
**Sucesso** (igual ao MVP + eco do operador)
```json
{ "ok": true,
  "data": { "nome": "Pablo Alcântara", "area": "Louvor", "checkinAt": "08/06/2026 12:06", "manual": true, "operador": "admin@seramor.com.br" },
  "error": null }
```
> `adminCheckout` análogo, devolvendo `checkoutAt` e `duracaoMin` como o `/checkout` do MVP.
> **Auditoria:** o backend **anexa** ao campo `Observações` da linha: `[manual: <operador> em <timestamp>]` (não sobrescreve o conteúdo existente).

### 5.4 `POST adminUpdatePhone` — Atualização de telefone (US-A3')
**Request**
```json
{ "action": "adminUpdatePhone", "operador": "admin@seramor.com.br",
  "voluntarioId": "Louvor::Maria Oliveira", "telefoneNovo": "11999998888" }
```
> Identificação do voluntário: **[A DEFINIR]** — usar par `area + nome` (como acima) ou um id estável
> se a `Base Voluntarios` ganhar coluna de id. Por ora `area + nome` resolve (homônimos desambiguados pela área).

**Sucesso**
```json
{ "ok": true,
  "data": { "nome": "Maria Oliveira", "area": "Louvor", "telefoneAntigo": "11988887777", "telefoneNovo": "11999998888",
            "gravado": ["origem", "base"], "operador": "admin@seramor.com.br" },
  "error": null }
```
**Comportamento:** localiza a linha do voluntário na aba `Voluntários` da **planilha da área** e grava o
telefone; em seguida atualiza a linha em **`Base Voluntarios`**. `gravado` indica onde teve efeito.

### Erros novos (somam ao catálogo §5 do Contrato)
| `code` | Quando | Mensagem ao usuário |
|--------|--------|---------------------|
| `VOLUNTEER_NOT_FOUND` | Voluntário não localizado na base/origem | "Voluntário não encontrado na base." |
| `DUPLICATE_PHONE` | Telefone novo já usado por outro cadastro ativo | "Este telefone já está em uso por outro voluntário." |
| `ORIGIN_NOT_FOUND` | Planilha de área/linha de origem não localizada | "Não foi possível atualizar na planilha da área. Verifique o cadastro." |
| `NO_RESULTS` | Busca sem correspondência | (tratado como lista vazia, sem erro) |

> `operador` ausente/malformado → reusar `INVALID_INPUT`. Erros de check-in/out manual reusam o catálogo do MVP (`ROW_NOT_FOUND`, `ALREADY_CHECKED_IN`, etc.).

---

## 6. Não-funcionais (recorte Fase 6)

| Tema | Decisão |
|------|---------|
| **Polling do Dashboard** | Intervalo **20–30s** (leve). Pausar quando a aba está em background (`visibilitychange`). **[A DEFINIR]** intervalo fino no piloto |
| **Latência** | `adminDashboard` lê a aba inteira 1×/poll → cabe na cota (Addendum §2 mediu ~4s no Apps Script). Se o painel ficar pesado, candidato a `CacheService`/Worker (mesma mitigação do MVP) |
| **Concorrência** | `adminCheckin/out` escrevem em linha única (sem lock). `adminUpdatePhone` mexe em 2 planilhas → usar `LockService` no append/edit |
| **Auditoria** | Toda ação de admin registra `operador` + timestamp (em `Observações` da linha afetada). **[A DEFINIR]** aba `Log Admin` dedicada se quiserem trilha consolidada |
| **Responsividt.** | Dashboard em grid ≥768px; demais telas mobile-first |
| **Acessibilidade** | WCAG AA, toque ≥44px — herdado do MVP |

---

## 7. Pendências de Discovery (Fase 6 enxuta)

1. **Backend admin sem auth (dívida aceita):** definir, pós-Fase 6, entre **token no header**
   validado pelo Apps Script **ou** Worker atrás de Zero Trust. (§2.2)
2. **Identificação do voluntário em `adminUpdatePhone`:** `area + nome` vs. coluna de id estável na base. (§5.4)
3. **Coluna de auditoria:** `Observações` (anexado) vs. aba `Log Admin` dedicada. (§6)
4. **Atualização de telefone na origem:** confirmar que o App Script consegue localizar a
   planilha-origem correta por área e que a consolidação **preserva** o telefone editado.
5. **Intervalo de polling** do Dashboard — calibrar no piloto.
6. **Override de escala e CRUD completo de voluntários** (US-A3/US-A4 originais) — **fora deste recorte**,
   tratar em iteração posterior da Fase 6.

---

## 8. Addendum de implementação (front · Jun/2026)

> Consolida o que foi efetivamente construído no frontend (React) e **prevalece**
> sobre as §§ acima nos pontos abaixo. O **backend Apps Script dos `action`s de
> admin ainda não existe** — o `/admin` roda contra um **mock** fiel a esta spec.

### 8.1 Stack, rota e mock toggle
> Supera §1 (Onde mora) e §2.

- **Rota `/admin`** no mesmo bundle, via **roteamento por path** em `src/main.tsx`
  (`/admin` → `AdminApp`; resto → check-in). Sem dependência de router.
  `public/_redirects` garante o SPA fallback no host estático (`/* → /index.html`).
- **Mock toggle `VITE_ADMIN_MOCK=1`** (`.env`): faz o `/admin` usar `src/api/adminMock.ts`
  mesmo com `VITE_API_URL` apontando pro backend real do MVP. Desligar quando o
  backend admin existir. Lógica em `src/lib/adminEnv.ts` (`ADMIN_MOCK`).
- **Camada de API:** `src/api/adminClient.ts` reusa o transporte `send` do MVP
  (timeout + retry). Tipos em `src/types/admin.ts`.
- **Identidade/Sair:** `src/lib/zeroTrust.ts` — `getIdentity()` lê o
  `/cdn-cgi/access/get-identity` (dev/mock → `admin@seramor.com.br`); `logout()`
  vai para `/cdn-cgi/access/logout` (dev/mock → `/`).

### 8.2 Shell / navegação
> Supera §4 (Shell) e os headers dos wireframes.

- Header: **removida a hora**; no lugar, **botão Sair (ícone apenas)** no canto
  superior direito. Um **spinner discreto** aparece só durante o polling.
- **Barra inferior com ícones**: Visão (grade) · Serviço (pessoa-check).

### 8.3 Visão (F6-A)
> Supera §4 F6-A.

- **Saudação no topo do conteúdo:** *"Olá `<e-mail do operador>`,"* (texto um pouco
  maior). É onde o e-mail aparece — **não** mais no header (§8.7). Só na Visão.
- Filtro de **Turno** com rótulo **"Todos"** (não "Todas"); **valor inicial pelo
  período do dia** (`inferTurno`: Manhã antes das 14h, senão Noite).
- **Ordenação das áreas** virou **controle interativo** (não mais rótulo fixo):
  **Menor % primeiro** (default) · **Maior % primeiro** · **Nome (A–Z)**. A ordem é
  **responsabilidade do front** (o `adminDashboard` devolve sem ordem garantida).
- Tocar num card de área abre **Serviço filtrado pela área**, **herdando o turno**
  atual do Dashboard (evita lista vazia).

### 8.4 Serviço (F6-B)
> Supera §4 F6-B e §5.2.

- **"Todas as áreas" lista todos** os escalados do turno; entrar pela aba abre com
  "Todas as áreas" + turno do período. **`adminSearch` aceita `nome` vazio**
  (lista todos do filtro) — **diverge** do "nome obrigatório (mín. 2)" do contrato.
- **Ordenação da lista** (novo controle): **Status** (default — Pendente → Em
  serviço → Concluído, nome como desempate) · **Alfabética (Nome)** · **Alfabética (Área)**.
- **Painel de ação** redesenhado no **estilo do check-in do voluntário**: dados da
  pessoa **centralizados** + **botão (Confirmar Check-in/Check-out) fixo na base** +
  link **✎ Atualizar cadastro** (abre F6-C para a pessoa).
- **Microcopy:** rótulo do campo de busca é **"Voluntários escalados"** (era "Buscar
  escalado de hoje").

### 8.5 Cadastro/telefone (F6-C)
Sem mudanças de regra: grava **origem + compilada**, com sucesso/erro
(`DUPLICATE_PHONE`) como na §4/§5.4. Busca de fallback reusa o `adminSearch` (hoje)
— a busca **base-wide** real continua como pendência (§7).

### 8.6 Estrutura de arquivos
```
src/admin/    AdminApp · AdminShell · VisaoScreen · ServicoScreen · CadastroScreen · DatePicker · ui
src/api/      adminClient.ts · adminMock.ts
src/types/    admin.ts
src/lib/      zeroTrust.ts · adminEnv.ts · date.ts (todayISO/isoToBR/longDateFromISO)
src/index.css utilitário .pt-safe-gap (respiro do header)
src/main.tsx  roteamento /admin
wrangler.toml SPA fallback no Cloudflare Workers (ver docs/Deploy_Cloudflare.md)
```

### 8.7 Header — data de referência (seletor de calendário)
> Supera §4 (Shell) e §8.2 no header.

- **Layout do header em 2 linhas:** linha 1 = logo + **"Base Voluntários"** (esq) · **Sair**
  (ícone, dir); linha 2 = **data por extenso** (esq), **alinhada ao texto** "Base
  Voluntários" (indenta pela largura do logo + gap). **O e-mail saiu do header** — virou a
  saudação na Visão (§8.3); o header fica mais limpo.
- **Respiro no topo:** utilitário `.pt-safe-gap` (`index.css`) = zona segura + 16px,
  igual às margens laterais (`px-4`).
- **Data de referência** exibida no padrão *"Domingo, 13 de Junho"* (`longDateFromISO`),
  com um **ícone de calendário** ao lado que abre um **calendário modal centralizado**
  (`src/admin/DatePicker.tsx` — sem dependências externas: navegação de mês, dia
  selecionado/hoje destacados).
- A data **default = hoje** (fuso SP) e é **estado do `AdminApp`**, compartilhada entre
  **Visão e Serviço** (não reseta ao trocar de aba). Ao mudar, re-consulta o painel.
- Vai às chamadas como **`data` (`DD/MM/YYYY`)** em `adminDashboard` e `adminSearch`
  (§5.1/§5.2). `adminCheckin`/`adminCheckout` já usam a `data` da `escala` selecionada.
- **Mock:** é **date-agnóstico** — sempre devolve a escala-semente e apenas **carimba** a
  data pedida. O backend real **filtraria as linhas pela data**.

---

*Especificação + Wireframes da Fase 6 (enxuta, v0.3 com addendum de implementação) —
painel `/admin` com Visão global, Check-in/out manual e Atualização de telefone.
Reaproveita o backend Apps Script e o frontend do MVP; acesso por Cloudflare Zero
Trust. Acompanha PRD v1.3, Especificação Fases Futuras e Contrato v1.2.*
