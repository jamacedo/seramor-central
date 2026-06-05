# Contrato de API — Check-in Igreja Ser Amor
**Versão:** 1.2 | **Acompanha:** PRD v1.3 | **Escopo:** MVP (Fases 1–4)

> 🛠️ **Addendum (Jun/2026):** mudanças e decisões da fase de implementação estão em [Ajustes_Fase_Implementacao.md](Ajustes_Fase_Implementacao.md) e **prevalecem** sobre este documento nos pontos indicados lá.

Contrato **portável**, mas o **backend definido é Apps Script**. Lógica e payloads valeriam igual num Worker.

> **Mudanças da v1.2:** spreadsheet único (índice de voluntários compilado na própria planilha de check-in); janelas de turno definidas; backend = Apps Script; US-10 entra no MVP; check-out desejável (não obrigatório); sem limite de tentativas.
> **Mudanças da v1.1:** formatos de dados reais (telefone, data, carimbo, flags); enums de áreas/turnos; "cadastrado" via abas `Voluntários`.

---

## 1. Convenções Gerais

| Item | Definição |
|------|-----------|
| **Método** | `POST` em todos os endpoints (telefone no corpo, **nunca na URL**) |
| **Content-Type** | `application/json` (Worker); `text/plain` (Apps Script, p/ evitar preflight CORS — ver Notas) |
| **Formato** | JSON na requisição e na resposta |
| **HTTP status** | **Não confiar** — Apps Script sempre devolve 200. Resultado vai no campo `ok` |
| **Fuso horário** | `America/Sao_Paulo` para "hoje" e para os carimbos |
| **Data atual** | Determinada **no servidor**, nunca enviada pelo cliente |

### Formatos de dados (confirmados com a planilha real)
| Campo | Formato | Exemplo |
|-------|---------|---------|
| `Telefone` | **11 dígitos, sem país, sem máscara** (`DDNNNNNNNNN`) | `11999998888` |
| `Data` | **`DD/MM/YYYY`** | `02/03/2025` |
| `Checkin` / `Checkout` | **`DD/MM/YYYY HH:MM`** (sem segundos) | `23/04/2025 09:50` |
| `In` / `Out` | **booleano** `TRUE` / `FALSE` | `TRUE` |

**Normalização do telefone (cliente e servidor):** remover tudo que não é dígito; se vier com `55` na frente (13 dígitos), descartar o prefixo; comparar sempre os 11 dígitos como **string**.

### Enums oficiais
| Enum | Valores |
|------|---------|
| `Turno` | `Manhã`, `Noite` |
| `Área` | `Acolhimento`, `Central`, `Clubinho`, `Ekoe`, `Foto e Vídeo`, `Iluminação`, `Logística`, `Louvor`, `Multimídia`, `Som`, `Transmissão` |

### Janelas de turno (para inferência automática)
| Turno | Janela |
|-------|--------|
| `Manhã` | 06:00 – 13:00 |
| `Noite` | 15:00 – 22:00 |

Usadas só para desempatar quando há 2+ escalas no mesmo dia: se o horário atual cai numa janela que corresponde a exatamente uma das escalas, resolve direto; caso contrário (gap das 13:00–15:00, fora do horário, ou empate), cai na tela de seleção (`MULTIPLE`, US-07).

### Envelope padrão
```json
{ "ok": true, "state": "CAN_CHECKIN", "data": { }, "error": null }
```
- `ok` — `true` se processou; `false` em falha real.
- `state` — só em `/resolve`.
- `error` — `{ "code": "...", "message": "..." }` quando `ok=false`.

---

## 2. Origem dos Dados

**Spreadsheet único:** `10lmOfSE4O8CnJOmyZ96i0f2k26uDxrV5QCEP9DlurRA`
(`https://docs.google.com/spreadsheets/d/10lmOfSE4O8CnJOmyZ96i0f2k26uDxrV5QCEP9DlurRA/`)

| Aba | Uso | Quando é lida |
|-----|-----|---------------|
| `Checkin Ser Amor` | Escala do dia + estado (`In`/`Out`/`Checkin`/`Checkout`) | Sempre |
| `Base Voluntarios` (índice compilado pelo App Script) | "Cadastrado" + nome/área/função para `NOT_SCHEDULED`/US-10 | Só no fallback (telefone fora da escala de hoje) |

> O índice `Base Voluntarios` é compilado pelo **App Script** a partir das abas `Voluntários` das 11 planilhas por área, e gravado nesta mesma planilha. Assim o backend lê **um só spreadsheet** para tudo. Colunas esperadas no índice: `Telefone · Nome · Área · Função · Ativo`.
> "Cadastrado" = telefone presente em `Base Voluntarios` (com `Ativo = TRUE`).

---

## 3. Máquina de Estados

| Linha hoje? | `In` | `Out` | `state` | Ação na UI |
|-------------|------|-------|---------|-----------|
| Não, e telefone não cadastrado | — | — | `NOT_FOUND` | Mensagem de orientação |
| Não, mas cadastrado | — | — | `NOT_SCHEDULED` | Orientação + opção US-10 |
| Sim | `FALSE` | `FALSE` | `CAN_CHECKIN` | Botão Confirmar Check-in |
| Sim | `TRUE` | `FALSE` | `IN_SERVICE` | Botão Confirmar Check-out |
| Sim | `TRUE` | `TRUE` | `DONE` | Mensagem "serviço completo" |
| 2+ linhas hoje | — | — | `MULTIPLE` | Tela de seleção (US-07) |

---

## 4. Endpoints

### 4.1 — `POST /resolve`
Primeira chamada do fluxo (e a única do one-tap).

**Request**
```json
{ "action": "resolve", "telefone": "11999998888" }
```

**`NOT_FOUND`**
```json
{ "ok": true, "state": "NOT_FOUND",
  "data": { "message": "Não encontramos este número na nossa base de voluntários. Por favor, procure o líder do seu ministério para atualizar seu cadastro." },
  "error": null }
```

**`NOT_SCHEDULED`** (cadastrado, sem escala hoje)
```json
{ "ok": true, "state": "NOT_SCHEDULED",
  "data": {
    "nome": "João Silva",
    "podeRegistrarForaDaEscala": true,
    "areaSugerida": "Louvor",
    "funcaoSugerida": "Vocal",
    "message": "Olá, João! Não localizamos você na escala de hoje. Caso tenha sido escalado, por favor, procure o líder do ministério."
  },
  "error": null }
```
> `areaSugerida`/`funcaoSugerida` vêm da aba `Voluntários` onde o telefone foi achado, para pré-preencher a US-10 (editáveis — substituto pode servir em outra área).

**`CAN_CHECKIN`**
```json
{ "ok": true, "state": "CAN_CHECKIN",
  "data": {
    "nome": "João Silva",
    "escala": { "telefone": "11999998888", "data": "01/06/2026", "area": "Louvor", "turno": "Manhã", "funcao": "Vocal" }
  },
  "error": null }
```

**`IN_SERVICE`**
```json
{ "ok": true, "state": "IN_SERVICE",
  "data": {
    "nome": "João Silva",
    "escala": { "telefone": "11999998888", "data": "01/06/2026", "area": "Louvor", "turno": "Manhã", "funcao": "Vocal" },
    "checkinAt": "01/06/2026 08:32"
  },
  "error": null }
```

**`DONE`**
```json
{ "ok": true, "state": "DONE",
  "data": {
    "nome": "João Silva",
    "escala": { "telefone": "11999998888", "data": "01/06/2026", "area": "Louvor", "turno": "Manhã", "funcao": "Vocal" },
    "checkinAt": "01/06/2026 08:32",
    "checkoutAt": "01/06/2026 11:05"
  },
  "error": null }
```

**`MULTIPLE`** (US-07)
```json
{ "ok": true, "state": "MULTIPLE",
  "data": {
    "nome": "João Silva",
    "opcoes": [
      { "data": "01/06/2026", "area": "Louvor",      "turno": "Manhã", "funcao": "Vocal", "estado": "CAN_CHECKIN" },
      { "data": "01/06/2026", "area": "Acolhimento", "turno": "Noite", "funcao": "Recepção", "estado": "IN_SERVICE", "checkinAt": "01/06/2026 18:40" }
    ]
  },
  "error": null }
```
> Cada opção carrega seu `estado`. O cliente chama `/checkin` ou `/checkout` com a chave da opção escolhida.

---

### 4.2 — `POST /checkin`
Grava `In = TRUE` + carimbo `DD/MM/YYYY HH:MM` em `Checkin`, na linha da chave única `Telefone + Data + Área + Turno`.

**Request**
```json
{ "action": "checkin", "telefone": "11999998888", "data": "01/06/2026", "area": "Louvor", "turno": "Manhã" }
```
**Sucesso**
```json
{ "ok": true,
  "data": { "nome": "João Silva", "area": "Louvor", "checkinAt": "01/06/2026 08:32" },
  "error": null }
```
**Erros:** `ROW_NOT_FOUND`, `ALREADY_CHECKED_IN` (devolve o `checkinAt` original, sem duplicar), `SHEET_UNAVAILABLE`.

---

### 4.3 — `POST /checkout`
Grava `Out = TRUE` + carimbo em `Checkout`.

**Request**
```json
{ "action": "checkout", "telefone": "11999998888", "data": "01/06/2026", "area": "Louvor", "turno": "Manhã" }
```
**Sucesso**
```json
{ "ok": true,
  "data": { "nome": "João Silva", "area": "Louvor", "checkinAt": "01/06/2026 08:32", "checkoutAt": "01/06/2026 11:05", "duracaoMin": 153 },
  "error": null }
```
**Erros:** `ROW_NOT_FOUND`, `NOT_CHECKED_IN`, `ALREADY_CHECKED_OUT`, `SHEET_UNAVAILABLE`.

---

### 4.4 — `POST /presenca-extra` (US-10 — SHOULD, pode ser adiada)
Insere nova linha na consolidada para quem chega fora da escala. Já registra o check-in.

**Pré-condição:** telefone **cadastrado** (`/resolve` retornou `NOT_SCHEDULED`). Telefone `NOT_FOUND` é rejeitado.

**Request**
```json
{ "action": "registerOutsideSchedule", "telefone": "11999998888",
  "area": "Louvor", "turno": "Manhã", "funcao": "Vocal",
  "motivo": "Substituindo Maria a pedido do líder" }
```
**Sucesso**
```json
{ "ok": true,
  "data": { "nome": "João Silva", "area": "Louvor", "checkinAt": "01/06/2026 08:35", "observacao": "Substituindo Maria a pedido do líder" },
  "error": null }
```
Grava nova linha: `Data = hoje`, `Área`, `Função`, `Turno`, `In = TRUE`, carimbo em `Checkin`, `motivo` em `Observações`.

**Erros:** `NOT_REGISTERED`, `MISSING_REASON`, `DUPLICATE`, `SHEET_UNAVAILABLE`.

---

## 5. Catálogo de Erros

| `code` | Quando | Mensagem ao usuário |
|--------|--------|---------------------|
| `ROW_NOT_FOUND` | Chave não localiza linha (escala mudou) | "Não encontramos sua escala. Atualize a página e tente de novo." |
| `ALREADY_CHECKED_IN` | Check-in repetido | "Você já fez check-in às [hora]." |
| `NOT_CHECKED_IN` | Check-out sem check-in | "Faça o check-in antes de registrar a saída." |
| `ALREADY_CHECKED_OUT` | Check-out repetido | "Seu serviço de hoje já está concluído." |
| `NOT_REGISTERED` | Telefone fora da base na US-10 | "Procure o líder para fazer seu cadastro." |
| `MISSING_REASON` | US-10 sem motivo | "Informe o motivo para registrar presença fora da escala." |
| `DUPLICATE` | Linha duplicada na US-10 | "Já existe um registro seu para hoje nesta área." |
| `SHEET_UNAVAILABLE` | Falha de acesso à planilha | "Sistema indisponível no momento. Tente novamente em instantes." |
| `INVALID_INPUT` | Telefone malformado / campos ausentes | "Verifique os dados informados." |

---

## 6. Notas de Implementação

**Leitura dos dados:**
- Tudo num spreadsheet só. Caminho feliz lê só a aba `Checkin Ser Amor`. O fallback (`NOT_SCHEDULED`/`NOT_FOUND`) lê a aba `Base Voluntarios`.
- **Data:** célula de data no Sheets volta como objeto `Date` (Apps Script). Formate para `DD/MM/YYYY` em `America/Sao_Paulo` antes de comparar com "hoje".
- **Telefone:** se a célula estiver como número, normalize para string de 11 dígitos antes de comparar.

**Escrita:** gravar `In`/`Out` como booleano `TRUE`/`FALSE` e os carimbos como texto `DD/MM/YYYY HH:MM` (sem segundos) — exatamente o formato atual, para não quebrar consolidação/relatórios.

**Roteamento (Apps Script):** `doPost(e)` único, roteando pelo campo `action`. No Worker, rotas reais ou o mesmo padrão.

**CORS / Content-Type:**
- Mesma origem (HTML Service, ou Pages+Worker no mesmo domínio) → `application/json`.
- Frontend separado → Apps Script: enviar `text/plain` e fazer `JSON.parse(e.postData.contents)` no servidor.

**Concorrência:** `/checkin` e `/checkout` escrevem em linhas distintas (chave única) → sem lock. `/presenca-extra` faz append → usar `LockService` (Apps Script) ou equivalente.

**Idempotência:** check-in/out repetidos devolvem o carimbo existente, sem duplicar.

**Privacidade:** telefone só no corpo; logs sem PII em texto puro; `/resolve` sem auth e sem limite de tentativas (acordado — baixo risco para o porte da igreja).

---

## 7. Dúvidas — Status

### ✅ Todas resolvidas
- Formatos de telefone, data, carimbo e flags → Seção 1.
- Áreas, turnos e janelas de turno → Seção 1.
- Origem dos dados → spreadsheet único `10lmOfSE...`, com índice `Base Voluntarios` compilado pelo App Script (Seção 2).
- "Cadastrado" → presença em `Base Voluntarios` com `Ativo = TRUE`.
- Backend → **Apps Script**.
- US-10 → **dentro do MVP**.
- Check-out → **desejável** (não obrigatório no MVP; pode virar obrigatório no futuro). Sem check-out automático.
- `/resolve` → sem limite de tentativas.

### ⚙️ Depende da implementação do App Script (consolidação)
- A aba `Base Voluntarios` precisa ser criada/populada pelo App Script com as colunas `Telefone · Nome · Área · Função · Ativo` antes da Fase 4.
- Confirmar que a consolidação não roda na janela de culto e preserva as colunas de presença (já confirmado que preserva).

---

*Contrato v1.2 — todas as dúvidas resolvidas. Backend em Apps Script, spreadsheet único. Pronto para implementação (ver código `Code.gs`).*
