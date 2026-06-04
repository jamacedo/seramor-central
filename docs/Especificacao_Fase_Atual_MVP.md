# Especificação Completa — Fase Atual (MVP)
## Sistema de Check-in de Voluntários · Igreja Ser Amor
**Versão:** 1.0 | **Escopo:** Fases 1–4 (check-in do voluntário) | **Backend:** Apps Script | **Data:** Mai/2026

Documento autocontido para construção do MVP. Consolida PRD v1.3, Contrato de API v1.2 e o backend `Code.gs`. As fases de gestão (5–6) estão no documento separado *"Especificação — Fases Futuras"*.

---

## 1. Visão Geral e Objetivo

Substituir a solução atual (Google Sheets + Google App Script + **App Sheet**) por um app de check-in próprio, acessado por **QR Code genérico**, em que o voluntário se identifica **apenas pelo telefone**. O sistema infere área, função, turno e culto cruzando o telefone com a escala do dia, e oferece **check-in ou check-out** conforme o estado.

O App Sheet é descontinuado; o Google Sheets permanece como banco de dados e o App Script atual continua compilando as escalas.

**Métrica-norte do MVP:** ≥ 85% dos voluntários escalados fazendo check-in digital por culto, com check-in completo em < 15 segundos.

---

## 2. Escopo da Fase Atual

### Entra (MVP)
- QR Code genérico → tela de telefone → inferência de escala.
- Máquina de estados: não cadastrado, não escalado, pode check-in, em serviço (check-out), concluído, seleção múltipla.
- Check-in e check-out no mesmo fluxo.
- One-tap (salvar telefone no aparelho).
- Presença fora da escala com motivo (US-10), restrita a cadastrados.
- Backend Apps Script lendo/gravando num spreadsheet único.

### Não entra (fica para depois ou fora do produto)
- Painéis de líder (`/lider`) e admin (`/admin`) → Fases 5–6.
- App nativo iOS/Android (solução web-first).
- Notificações push / lembretes de escala.
- Cadastro de novos voluntários pelo app (segue via líder).
- Uso das colunas de substituição (`Voluntário Substituto`, `Data Troca`, `Motivo da Troca`).
- Check-out automático por horário.
- Migração da lógica de consolidação (segue no App Script atual).

### Trade-offs assumidos
- **Google Sheets + App Script como banco/consolidação:** custo zero e reaproveita o que existe; aceita limites de concorrência (folgados para <100 voluntários/culto).
- **Inferência por data/hora:** QR único e operação simples; exige tela de seleção quando há 2+ escalas no dia.
- **Auth por telefone (sem senha):** onboarding instantâneo; sem login de conta, mitigado pelo one-tap.

---

## 3. Arquitetura

```
[QR genérico] → [SPA / Frontend]
                     │  POST JSON
                     ▼
            [Apps Script Web App]  ── lê/grava ──►  [Planilha única Google Sheets]
                     ▲                                  ├─ aba "Checkin Ser Amor" (escala + presença)
                     │                                  └─ aba "Base Voluntarios" (índice p/ fallback)
        [App Script de consolidação] ── compila ──────────┘
        (agendado; preserva colunas de presença)
```

- **Frontend:** SPA leve. Hospedagem via HTML Service do próprio Apps Script (mesma origem, sem CORS) ou estática separada (trata CORS via `text/plain`).
- **Backend:** Apps Script Web App, `doPost` único roteado por `action`.
- **Dados:** um spreadsheet (ID `10lmOfSE4O8CnJOmyZ96i0f2k26uDxrV5QCEP9DlurRA`).
- **Consolidação:** App Script existente, **agendado**, que **sempre preserva** as colunas de presença e passa a compilar também a aba `Base Voluntarios`.

---

## 4. Modelo de Dados

**Spreadsheet único:** `10lmOfSE4O8CnJOmyZ96i0f2k26uDxrV5QCEP9DlurRA`

### Aba `Checkin Ser Amor` (escala + presença)
Colunas: `In` · `Out` · `Voluntário` · `Função` · `Turno` · `Data` · `Checkin` · `Checkout` · `Observações` · `Telefone` · `Voluntário Substituto` · `Data Troca` · `Motivo da Troca` · `Área`

### Aba `Base Voluntarios` (índice para fallback — a ser compilada pelo App Script)
Colunas: `Telefone` · `Nome` · `Área` · `Função` · `Ativo`

### Formatos (confirmados com a planilha real)
| Campo | Formato | Exemplo |
|-------|---------|---------|
| Telefone | 11 dígitos, sem país, sem máscara | `11999998888` |
| Data | `DD/MM/YYYY` | `02/03/2025` |
| Checkin / Checkout | `DD/MM/YYYY HH:MM` (sem segundos) | `23/04/2025 09:50` |
| In / Out | booleano `TRUE`/`FALSE` | `TRUE` |

### Enums
| Enum | Valores |
|------|---------|
| Turno | `Manhã`, `Noite` |
| Área | `Acolhimento`, `Central`, `Clubinho`, `Ekoe`, `Foto e Vídeo`, `Iluminação`, `Logística`, `Louvor`, `Multimídia`, `Som`, `Transmissão` |

### Janelas de turno (inferência)
`Manhã` = 06:00–13:00 · `Noite` = 15:00–22:00. Usadas apenas para desempatar 2+ escalas no mesmo dia.

### Chave única
`Telefone + Data + Área + Turno` identifica uma linha de forma única na aba de check-in. É a chave usada para gravar presença.

### "Cadastrado"
Telefone presente na aba `Base Voluntarios` com `Ativo = TRUE`.

---

## 5. Máquina de Estados

| Linha hoje? | `In` | `Out` | Estado | Ação na UI |
|-------------|------|-------|--------|-----------|
| Não, telefone não cadastrado | — | — | `NOT_FOUND` | Orientação (procurar líder) |
| Não, mas cadastrado | — | — | `NOT_SCHEDULED` | Orientação + opção US-10 |
| Sim | `FALSE` | `FALSE` | `CAN_CHECKIN` | Botão Confirmar Check-in |
| Sim | `TRUE` | `FALSE` | `IN_SERVICE` | Botão Confirmar Check-out |
| Sim | `TRUE` | `TRUE` | `DONE` | Mensagem "serviço completo" |
| 2+ linhas hoje | — | — | `MULTIPLE` | Tela de seleção (turno tenta desempatar antes) |

---

## 6. Requisitos Funcionais

| ID | Prioridade | Descrição |
|----|-----------|-----------|
| US-01 | MUST | Check-in via QR genérico: voluntário informa o telefone, sistema infere a escala do dia |
| US-02 | MUST | Telefone não encontrado → mensagem para procurar o líder |
| US-03 | MUST | Cadastrado mas não escalado hoje → identifica pelo nome + orienta + oferece US-10 |
| US-04 | MUST | Caminho feliz: confirmar check-in (grava `In=TRUE` + `Checkin`) |
| US-05 | MUST | Check-out no mesmo QR (grava `Out=TRUE` + `Checkout`); estado concluído sem botão |
| US-06 | SHOULD | One-tap: salvar telefone cifrado no aparelho; reabrir já resolve o estado do dia |
| US-07 | SHOULD | Disambiguação de 2+ escalas no dia (inferência por turno → senão tela de seleção) |
| US-10 | SHOULD (no MVP) | Presença fora da escala com motivo obrigatório, só para telefone cadastrado |

> US-08 (dashboard líder) e US-09 (check-in manual admin) pertencem às Fases 5–6.

### Detalhe das mensagens (texto ao usuário)
- **NOT_FOUND:** "Não encontramos este número na nossa base de voluntários. Por favor, procure o líder do seu ministério para atualizar seu cadastro."
- **NOT_SCHEDULED:** "Olá, [Nome]! Não localizamos você na escala de hoje. Caso tenha sido escalado, por favor, procure o líder do ministério."
- **CAN_CHECKIN:** "Olá, [Nome]! Confirmar entrada no Ministério [Área] como [Função]?"
- **IN_SERVICE:** "Olá, [Nome]! Você entrou às [hora]. Confirmar saída do Ministério [Área]?"
- **DONE:** "Olá, [Nome]! Seu serviço de hoje já está completo. Obrigado por servir!"

---

## 7. Contrato de API (resumo)

Backend Apps Script, `POST` em todos, telefone no corpo. Resultado no campo `ok` (Apps Script sempre devolve HTTP 200). Detalhe completo de payloads no documento *Contrato de API v1.2*.

| Endpoint (`action`) | Entrada principal | Saída |
|---------------------|-------------------|-------|
| `resolve` | `telefone` | `state` + dados (nome, escala, carimbos, opções) |
| `checkin` | `telefone, data, area, turno` | nome, área, `checkinAt` |
| `checkout` | `telefone, data, area, turno` | nome, área, `checkinAt`, `checkoutAt`, `duracaoMin` |
| `registerOutsideSchedule` | `telefone, area, turno, funcao, motivo` | nome, área, `checkinAt`, observação |

**Envelope:** `{ "ok": true|false, "state": "...", "data": {...}, "error": {code,message} }`
**Erros:** `ROW_NOT_FOUND`, `ALREADY_CHECKED_IN`, `NOT_CHECKED_IN`, `ALREADY_CHECKED_OUT`, `NOT_REGISTERED`, `MISSING_REASON`, `DUPLICATE`, `SHEET_UNAVAILABLE`, `INVALID_INPUT`.

---

## 8. Backend (Apps Script)

Implementação no arquivo **`Code.gs`** (entregue à parte). Características:
- `doPost` único, roteado por `action`; `doGet` como health check.
- Leitura por **nome de cabeçalho** (resiliente a reordenação de colunas); nomes em `CONFIG.COL`.
- Caminho feliz lê só `Checkin Ser Amor`; fallback lê `Base Voluntarios`.
- `LockService` no append da US-10; idempotência em check-in/out.
- Telefone normalizado para 11 dígitos; datas/carimbos formatados em `America/Sao_Paulo`.

**Deploy:** Implantar → Nova implantação → App da Web → Executar como "Eu" → Acesso "Qualquer pessoa".

**Validar contra a planilha real antes de produção:**
1. `Checkin`/`Checkout` são células de data/hora (o código grava `Date`) ou texto? Se texto, ajustar para gravar string formatada.
2. Aba `Base Voluntarios` precisa existir e ser populada pelo App Script de consolidação (`Telefone·Nome·Área·Função·Ativo`). Sem ela, fallback e US-10 não operam (caminho feliz funciona).
3. Conta dona do web app precisa ter edição na planilha.

---

## 9. Frontend (SPA)

### Telas / fluxo
1. **Entrada:** campo de telefone com máscara `(XX) XXXXX-XXXX`, teclado numérico, botão "Buscar". (Pulada no one-tap.)
2. **Resultado por estado:**
   - `NOT_FOUND` / `NOT_SCHEDULED`: mensagem; em `NOT_SCHEDULED`, botão secundário "Vou servir hoje mesmo assim" → fluxo US-10.
   - `CAN_CHECKIN`: cartão com nome/área/função + botão verde **Confirmar Check-in**.
   - `IN_SERVICE`: cartão com horário de entrada + botão **Confirmar Check-out**.
   - `DONE`: mensagem de serviço concluído (entrada/saída exibidas).
   - `MULTIPLE`: lista de opções (Área · Turno · Função), cada uma levando ao seu estado.
3. **Sucesso:** confirmação visual (nome, área, horário; no check-out, duração).
4. **US-10:** seleção de Área (enum) + Função + campo de motivo obrigatório.

### Comportamentos
- **One-tap:** após sucesso, se o toggle "Salvar meus dados neste aparelho" estiver marcado, guardar o telefone **cifrado** em `localStorage`. Reabrir o QR com dado salvo → chama `resolve` direto. Botão "Sair / Usar outro número" limpa o storage.
- **Normalização:** remover não-dígitos (e `55` inicial) antes de enviar.
- **Estados de carregamento:** spinner em toda chamada (Apps Script responde ~1–2s); retry automático 1x em timeout (>5s).
- **Offline:** mensagem orientando procurar o líder.

### Acessibilidade
Contraste WCAG AA; botões ≥ 44×44px; input com teclado numérico; textos legíveis para faixa etária ampla.

---

## 10. Requisitos Não-Funcionais

**Performance:** carregamento da SPA < 2s em 4G; check-in completo < 15s. (Apps Script ~1–2s por chamada — cobrir com bom estado de carregamento.)

**Volume:** < 100 voluntários/culto. Cota da Sheets API folgada; sem cache/KV.

**Integridade de dados:** consolidação **sempre preserva** `In`/`Out`/`Checkin`/`Checkout` (confirmado); chave `Telefone+Data+Área+Turno` única; consolidação não deve apagar linhas da US-10 e, idealmente, não rodar na janela de culto.

**Segurança/LGPD:** telefone só no corpo das requisições (nunca em URL); telefone cifrado no `localStorage` com opção de remoção; logs sem PII em texto puro; `/resolve` sem auth e sem limite de tentativas (acordado).

**Acessibilidade:** WCAG AA conforme Seção 9.

---

## 11. Edge Cases

| Cenário | Comportamento |
|---------|--------------|
| Substituto / fora da escala (telefone diferente) | US-10 (motivo obrigatório); só para cadastrados |
| Check-in repetido | `In=TRUE` → oferece check-out; não duplica |
| 2+ escalas no dia | Inferência por turno; senão tela de seleção (US-07) |
| Cadastrado mas nunca escalado | `NOT_SCHEDULED` via `Base Voluntarios` |
| Timeout (>5s) | Spinner + retry 1x; depois erro com orientação |
| DDI/formatos diversos | Normalização para 11 dígitos |
| Offline | Mensagem offline |
| One-tap de culto anterior | Estado recalculado por data/hora no servidor — telefone salvo é seguro |
| Check-in sem check-out | Fica "Em serviço"; check-out desejável, não bloqueante |
| Planilha indisponível | `SHEET_UNAVAILABLE` (503-like) sem quebrar a tela |

---

## 12. Critérios de Aceite

| US | Dado | Quando | Então |
|----|------|--------|-------|
| US-02 | Telefone inexistente | `resolve` | `NOT_FOUND` + mensagem |
| US-03 | Cadastrado, sem escala hoje | `resolve` | `NOT_SCHEDULED` + nome + opção US-10 |
| US-04 | Escalado, `In=FALSE` | confirma | `In=TRUE` + `Checkin`; tela de sucesso |
| US-05 | `In=TRUE, Out=FALSE` | confirma | `Out=TRUE` + `Checkout`; duração exibida |
| US-05 | `Out=TRUE` | `resolve` | Mensagem de concluído, sem botão |
| US-06 | One-tap ativo | reabre | Pula input, resolve estado do dia |
| US-07 | 2+ escalas, turno não resolve | `resolve` | Tela de seleção |
| US-10 | Cadastrado fora da escala + motivo | confirma | Nova linha com `In=TRUE`, `Checkin`, motivo em `Observações` |

---

## 13. Métricas de Sucesso (MVP)

| Métrica | Baseline | Target | Prazo |
|---------|----------|--------|-------|
| Taxa de check-in digital | medir no piloto | ≥ 85% | 30 dias pós-MVP |
| Tempo médio de check-in | medir no piloto | < 15s | ao lançar |
| Taxa de check-out registrado | — | ≥ 60% dos check-ins | 30 dias |
| Adoção do one-tap | 0% | ≥ 60% dos recorrentes | 30 dias |
| Uso de presença fora da escala (US-10) | — | < 10% do total | por culto |

---

## 14. Riscos (MVP)

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Latência/concorrência do Apps Script no pico de chegada | Média | Médio | Validar no piloto; bom estado de carregamento; se necessário, migrar rota para Worker (contrato idêntico) |
| `Base Voluntarios` não pronta a tempo | Média | Médio | Lançar piloto sem fallback/US-10; caminho feliz funciona; ligar depois |
| App Script apaga linhas da US-10 | Baixa | Médio | Garantir preservação; agendar fora do culto |
| Voluntários com dificuldade de digitar telefone | Média | Médio | Máscara, teclado numérico, one-tap; futuramente check-in manual (Fase 6) |
| QR físico danificado | Média | Médio | Boa impressão + link curto de fallback |
| Carimbo gravado em formato incompatível | Baixa | Médio | Validar tipo da célula antes do go-live (Seção 8) |

---

## 15. Plano de Execução (Fases 1–4)

| Fase | Escopo | Critério de conclusão |
|------|--------|----------------------|
| 1 ✅ | Dados/estrutura no Sheets | Base validada |
| 2 | Backend Apps Script (`Code.gs`) + ajuste do App Script para compilar `Base Voluntarios` | Backend resolve todos os estados; índice populado |
| 3 | Frontend SPA (QR, máscara, máquina de estados, one-tap, US-07, US-10) | Checklist de UX validado com ≥1 líder |
| 4 | Piloto em 1 área em culto real + medição de latência no rush | ≥10 check-ins/out reais sem erro crítico |

### Marcos
- **M1:** Backend resolve todos os estados por telefone+data.
- **M2:** Primeiro check-in/out real via QR em culto.
- **M4:** App Sheet desativado (após Fases 5–6 cobrirem 100% das áreas).

---

## 16. Pendências / Itens a Validar

1. Tipo das células `Checkin`/`Checkout` (data/hora vs texto) — ajusta a gravação no `Code.gs`.
2. App Script passar a compilar a aba `Base Voluntarios` (`Telefone·Nome·Área·Função·Ativo`).
3. Confirmar que a consolidação não roda na janela de culto e não apaga linhas da US-10.
4. Definir esquema de cifragem do telefone no `localStorage` (frontend).
5. Decidir hospedagem do frontend: HTML Service (mesma origem) vs estática separada.
6. Origem das listas de Área/Função na tela da US-10 (usar enums oficiais).

---

*Especificação completa da fase atual (MVP). Acompanha: PRD v1.3, Contrato de API v1.2, `Code.gs`.*
