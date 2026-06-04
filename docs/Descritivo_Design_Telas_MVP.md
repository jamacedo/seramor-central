# Descritivo de Design — Telas do MVP (Fases 1–4)
## Sistema de Check-in de Voluntários · Igreja Ser Amor
**Versão:** 1.0 | **Escopo de design:** jornada do voluntário (QR → telefone → check-in/out) | **Base:** Especificação MVP + PRD v1.3 | **Data:** Jun/2026

> Documento de referência para criação das telas no Figma. Traduz a máquina de estados e os requisitos funcionais (US-01 a US-10) em um sistema de design enxuto, acessível e otimizado para velocidade (meta: check-in < 15s). Não cobre os painéis `/lider` e `/admin` (Fases 5–6).

---

## 1. Norte de Design

**Frase-guia:** *"Chegou, escaneou, confirmou, serviu."* A interface deve desaparecer atrás da tarefa.

| Princípio | O que significa na prática |
|-----------|----------------------------|
| **Velocidade acima de tudo** | 1 ação principal por tela; zero decisões desnecessárias; caminho feliz em ≤ 2 toques após o telefone |
| **Um único foco por tela** | Cada estado da máquina = 1 tela com 1 botão primário claro |
| **Inclusivo por faixa etária (18–60+)** | Tipografia grande, alvos de toque generosos, linguagem calorosa e direta |
| **Confiança e pertencimento** | Tom acolhedor ("Olá, [Nome]!"), identidade visual da igreja, feedback positivo no sucesso |
| **Tolerante a erro e à pressa** | Máscara de telefone, teclado numérico, estados de carregamento honestos, mensagens que dizem o que fazer |
| **Acessível (WCAG AA)** | Contraste ≥ 4.5:1, alvos ≥ 44×44px, foco visível, não depender só de cor |

**Contexto de uso real (dimensiona as decisões):**
- Mão única, em pé, na entrada do culto, com pressa, possivelmente sob sol/baixa luz.
- Conexão móvel variável (4G a oscilante) → estados de carregamento e offline são parte do produto, não exceção.
- Aparelho pessoal do voluntário (variedade enorme de telas Android/iOS).

---

## 2. Sistema Visual (Design Tokens)

> **Status (jun/2026):** tokens aprovados e aplicados no FlutterFlow Designer via MCP. Os valores abaixo são os oficiais — substituem os placeholders semânticos da v1.0.

### 2.1 Cores — valores aprovados ✅

| Token | Valor hex | Uso |
|-------|-----------|-----|
| `primary` | `#D3642A` | Marca, cabeçalho, links, data na T1 |
| `action_checkin` | `#16A34A` | Botão "Confirmar Check-in" (verde) |
| `action_checkout` | `#2563EB` | Botão "Confirmar Check-out" (azul, distinto do verde) |
| `success` | `#16A34A` | Ícone ✓ e tela de sucesso |
| `warning` | `#D97706` | NOT_SCHEDULED / atenção |
| `error` | `#DC2626` | NOT_FOUND / falhas |
| `background` | `#FFFFFF` | Fundo de todas as telas |
| `surface` | `#FFFFFF` | Cards e superfícies elevadas |
| `primary_text` | `#1C1917` | Texto principal (near-black quente) |
| `secondary_text` | `#78716C` | Texto secundário / helpers |
| `mono` → `primary` | Inter | Fonte mono redirecionada para Inter (elimina JetBrains Mono nos campos) |

> **Regra:** estado nunca é comunicado só por cor. Sempre acompanha ícone + texto (ex.: ✓ Sucesso, ⚠ Atenção).

### 2.2 Tipografia — escala aprovada ✅

| Token | Tamanho | Peso | Uso |
|-------|---------|------|-----|
| `h1` | 32px | 700 | Título de sucesso ("Check-in confirmado!") |
| `h2` | 28px | 700 | Saudação ("Bem vinda(o), [Nome]!") |
| `title` | 26px | 700 | Header "Ser Amor" |
| `body` | 18px | 400 | Corpo de texto, perguntas de confirmação |
| `label` | 16px | 500 | Labels de campo, "Usar outro número" |
| `helper` | 14px | 400 | Helper text, microcopy de privacidade |

- Família: **Inter** (Google Fonts) — uniforme em todos os elementos, incluindo inputs e botões.
- Altura de linha: 1.18–1.45 conforme token.

### 2.3 Espaçamento e layout
- Grid base **8px**; respiros generosos (a tela não precisa ser densa).
- Largura máxima de conteúdo ~440px, centralizado (mobile-first).
- Botão primário **fixo na parte inferior** (alcance do polegar), largura total com margem lateral (token `lg`).
- Conteúdo central distribuído verticalmente (padrão `expanded` + `column align=center`).

### 2.4 Componentes de toque
- Altura mínima de botão **56px** (generoso; maior que os 48px mínimos); padding lateral confortável.
- Texto do botão: **20px / peso 700** (padronizado em T1 "Buscar" e T3 "Confirmar Check-in").
- Input de telefone: altura **64px**, label visível, máscara `(XX) XXXXX-XXXX`, tamanho `large`.
- Raio de borda: cards 16px, inputs 12px (`radius/input`), botões 12px. Sombra sutil nos cartões.
- Header: altura **72px**, sem linha divisória, fundo branco contínuo com o conteúdo.

### 2.5 Decisões visuais fixadas nesta sessão ✅

| Decisão | Escolha |
|---------|---------|
| Toggle one-tap marcado por padrão? | **Sim** — default ON, com microcopy de privacidade |
| Fonte mono (inputs, botões) | Eliminada → tudo em **Inter** |
| Linha divisória no header | **Removida** — header sem borda, fundo branco contínuo |
| Marca no header | **Centralizada** nas telas sem ação de navegação; com "‹ Voltar" à esquerda nas que têm |
| Identity card na T3 | Removido pelo stakeholder — tela sem o card |

### 2.5 Iconografia e ilustração
- Ícones simples, line/filled consistentes (✓ sucesso, ⚠ atenção, ⊘ não encontrado, ⏱ horário, 📍 área).
- Ilustração/marca leve no topo para acolhimento, sem pesar o carregamento.

---

## 3. Mapa de Fluxo e Inventário de Telas

```
                        ┌─────────────────────┐
   QR genérico  ───────►│  T1 · Entrada        │
                        │  (campo telefone)    │
                        └──────────┬───────────┘
        one-tap salvo ──┐          │ "Buscar" → resolve
        (pula T1)       │          ▼
                        │   [ máquina de estados ]
                        │          │
   ┌────────────┬───────┴────┬─────┴─────┬──────────────┬──────────────┐
   ▼            ▼            ▼           ▼              ▼              ▼
 T2a          T2b          T3          T4            T5             T6
 NOT_FOUND  NOT_SCHEDULED CAN_CHECKIN IN_SERVICE     DONE         MULTIPLE
   │            │            │           │              │              │
   │       "Vou servir"      │ confirma  │ confirma     │         seleciona linha
   │            ▼            ▼           ▼              │              │
   │          T7 ·         T8 · Sucesso  T8 · Sucesso   │         volta a T3/T4
   │          US-10        (check-in)    (check-out)    │
   │        (fora escala)   │              │            │
   │            └──► T8 ─────┘              │            │
   │                                       │            │
   └───────────────────── estados terminais / orientação ───────────┘

   Sobrepostos a qualquer tela:  L · Loading  ·  E · Erro/Timeout  ·  O · Offline
```

### Inventário (12 telas/estados)

| # | Tela / Estado | Origem | US | Prioridade |
|---|---------------|--------|----|-----------|
| T1 | **Entrada** — campo de telefone | QR (ou pulada por one-tap) | US-01 | MUST |
| T2a | **NOT_FOUND** — não cadastrado | resolve | US-02 | MUST |
| T2b | **NOT_SCHEDULED** — cadastrado, sem escala | resolve | US-03 | MUST |
| T3 | **CAN_CHECKIN** — confirmar entrada | resolve | US-04 | MUST |
| T4 | **IN_SERVICE** — confirmar saída | resolve | US-05 | MUST |
| T5 | **DONE** — serviço concluído | resolve | US-05 | MUST |
| T6 | **MULTIPLE** — seleção de escala | resolve | US-07 | SHOULD |
| T7 | **US-10** — presença fora da escala | a partir de T2b | US-10 | SHOULD |
| T8 | **Sucesso** — check-in / check-out / US-10 | após confirmar | US-04/05/10 | MUST |
| L | **Loading** (overlay/inline) | toda chamada | NFR | MUST |
| E | **Erro / Timeout** | falha de chamada | Edge | MUST |
| O | **Offline** | sem conexão | Edge | MUST |

---

## 4. Descritivo Detalhado por Tela

> Cada tela segue o mesmo esqueleto: **Cabeçalho leve (marca)** → **Conteúdo (1 mensagem/foco)** → **Ação primária fixa embaixo** → **Ação secundária opcional (link/ghost)**.

### T1 · Entrada (US-01)
- **Objetivo:** capturar o telefone com o mínimo de atrito.
- **Conteúdo aprovado:** linha de data contextual em terracota ("Domingo, 7 de Junho"), saudação H1 **"Bem-vinda(o)!"**, subtítulo "Confirme sua presença como voluntário"; 1 input de telefone.
- **Copy anterior substituído:** "Bem-vindo! Confirme sua presença" → textos acima.
- **Input:** label "Seu telefone", máscara `(XX) XXXXX-XXXX`, **`inputmode="numeric"`** (abre teclado numérico), placeholder de exemplo, foco automático. Altura **64px** (tamanho `large`).
- **Ação primária:** botão **Buscar** (largura total, fixo embaixo, 56px, texto 20px/700). Desabilitado até 11 dígitos.
- **Comportamento:** ao tocar, vira estado **Loading** (T-L); normaliza removendo não-dígitos e `55` inicial antes de enviar.
- **Acessibilidade:** label sempre visível (não só placeholder); erro de formato inline ("Digite os 11 dígitos com DDD").
- **One-tap:** se houver telefone salvo, **esta tela é pulada** e vai direto ao Loading → estado do dia.

### T2a · NOT_FOUND (US-02)
- **Tom:** neutro e orientador, sem culpar o usuário.
- **Conteúdo:** ícone ⊘/info; mensagem exata: *"Não encontramos este número na nossa base de voluntários. Por favor, procure o líder do seu ministério para atualizar seu cadastro."*
- **Ações:** secundária **"Tentar outro número"** → volta a T1 limpo. Sem ação primária de gravação.
- **Visual:** cor de feedback neutra/erro suave (não alarmante).

### T2b · NOT_SCHEDULED (US-03)
- **Conteúdo:** saudação personalizada: *"Olá, [Nome]! Não localizamos você na escala de hoje. Caso tenha sido escalado, por favor, procure o líder do ministério."*
- **Ação primária (condicional à US-10 habilitada):** botão secundário **"Vou servir hoje mesmo assim"** → T7.
- **Ação secundária:** "Usar outro número" → T1.
- **Nota de design:** se US-10 estiver desligada no piloto, ocultar o botão e manter só a orientação.

### T3 · CAN_CHECKIN (US-04) — caminho feliz
- **Layout:** saudação H2 centralizada + pergunta de confirmação. Identity card **removido** (decisão do stakeholder, jun/2026).
- **Mensagem aprovada:** H2 "Bem vinda(o), [Nome]!"; corpo "Confirmar sua entrada na área [Área] como [Função]?"
- **Header:** "‹ Voltar" no canto superior esquerdo + "❤ Ser Amor" centralizado.
- **Ação primária:** botão **verde** `action/checkin`, 56px, texto 20px/700, **"✓ Confirmar Check-in"**, fixo embaixo.
- **Toggle one-tap:** ✅ **marcado por padrão** (decisão confirmada). Microcopy: "Salvar meus dados neste aparelho" + "Seu telefone fica salvo só neste aparelho. Você pode remover depois."
- **Ação:** toque → Loading → T8 (sucesso de check-in).

### T4 · IN_SERVICE (US-05) — check-out
- **Layout:** mesmo cartão de identidade + **horário de entrada destacado** (⏱ "Entrada às 09:50").
- **Mensagem:** *"Olá, [Nome]! Você entrou às [hora]. Confirmar saída do Ministério [Área]?"*
- **Ação primária:** botão **"Confirmar Check-out"** em cor distinta do check-in (token `action/checkout`) para evitar confusão de ação.
- **Ação:** toque → Loading → T8 (sucesso de check-out, com duração).

### T5 · DONE (US-05)
- **Tom:** celebrativo e de gratidão.
- **Conteúdo:** ícone ✓; *"Olá, [Nome]! Seu serviço de hoje já está completo. Obrigado por servir!"*; exibir **entrada e saída** (e duração, se útil).
- **Ações:** **sem botão de ação primária.** Apenas link discreto "Sair / Usar outro número" (limpa one-tap).

### T6 · MULTIPLE (US-07) — disambiguação
- **Quando:** 2+ escalas no dia que o turno não desempatou.
- **Conteúdo:** título *"Você está escalado em mais de uma área hoje. Selecione:"*
- **Lista:** cada item é um **cartão tocável** mostrando **Área · Turno · Função** (alvo ≥ 48px, claramente separados). Indicar visualmente se a linha já tem check-in (ex.: selo "Em serviço").
- **Ação:** tocar um item → resolve aquela linha → leva ao estado correspondente (T3 ou T4).
- **Acessibilidade:** itens como botões/radios navegáveis por teclado e leitor de tela.

### T7 · US-10 — Presença fora da escala (SHOULD)
- **Pré-condição:** só acessível a partir de T2b (telefone cadastrado).
- **Campos:**
  1. **Área** — seletor (enum oficial: Acolhimento, Central, Clubinho, Ekoe, Foto e Vídeo, Iluminação, Logística, Louvor, Multimídia, Som, Transmissão).
  2. **Função** — campo (texto ou seletor, conforme origem da lista — ver pendência §16.6 da Especificação).
  3. **Motivo** — campo de texto **obrigatório** (placeholder: "Ex.: substituindo Fulano, remanejado pelo líder").
- **Validação:** botão primário **"Confirmar presença"** desabilitado até Área + Função + Motivo preenchidos. Erro inline se motivo vazio (`MISSING_REASON`).
- **Ação:** confirma → Loading → T8 (sucesso, igual ao check-in). A partir daí, o check-out (T4) funciona normalmente.

### T8 · Sucesso (US-04/05/10)
- **Função:** confirmação visual inequívoca — fecha a tarefa com sensação de "pronto".
- **Variações:**
  - **Check-in:** ✓ + "Check-in confirmado!" + Nome · Área · horário de entrada.
  - **Check-out:** ✓ + "Check-out confirmado!" + Nome · Área · **duração do serviço** (entrada → saída).
  - **US-10:** ✓ + "Presença registrada!" + Nome · Área · horário.
- **Microinteração:** animação curta de check (≤ 400ms), não bloqueante.
- **Ações:** link "Sair / Usar outro número". Se one-tap acabou de ser ativado, breve reforço ("Seus dados ficaram salvos neste aparelho").

### Estados transversais

**L · Loading**
- Spinner + microcopy honesto ("Buscando sua escala…" / "Confirmando…"). Cobre o ~1–2s do Apps Script.
- Botão que disparou a ação entra em estado *loading* (desabilitado, spinner inline) para evitar duplo toque.
- Retry automático 1× em timeout (>5s) é silencioso; só após a 2ª falha mostra T-E.

**E · Erro / Timeout / Planilha indisponível**
- Mensagem amigável, sem jargão: "Não conseguimos concluir agora. Tente de novo em instantes ou procure o líder."
- Ação primária **"Tentar novamente"**; mapear erros do contrato (`SHEET_UNAVAILABLE`, `ROW_NOT_FOUND` etc.) para mensagens humanas, nunca expor códigos.
- Casos idempotentes (`ALREADY_CHECKED_IN`, `ALREADY_CHECKED_OUT`) **não são erro de usuário** → redirecionar ao estado correto (T4 ou T5) em vez de mostrar erro.

**O · Offline**
- Detecção de ausência de rede: tela dedicada com ícone offline + "Você está sem conexão. Conecte-se e tente novamente, ou procure o líder."
- Botão "Tentar novamente".

---

## 5. Componentes Reutilizáveis (biblioteca Figma)

| Componente | Variantes | Onde aparece |
|------------|-----------|--------------|
| **Button** | primary / secondary / ghost · default / loading / disabled · checkin / checkout | Todas |
| **Phone Input** | default / focus / error / filled | T1 |
| **Identity Card** | check-in / in-service / done (mostra Nome, Área, Função, horários) | T3, T4, T5 |
| **Message Block** | success / warning / error / info (ícone + título + corpo) | T2a, T2b, T5, T8, E, O |
| **Selectable List Item** | default / pressed / com-selo-status | T6 |
| **Form Field** | select / text · default / error / disabled | T7 |
| **Toggle/Checkbox** | one-tap "salvar dados" | T3, T7 |
| **Loading Overlay** | inline (botão) / fullscreen | transversal |
| **App Header** | marca + (opcional) "sair/trocar número" | Todas |

> Construir com **Auto Layout + Variants + Variables**. Documentar estados e tokens junto de cada componente para handoff direto ao dev (SPA hospedada via HTML Service ou estática).

---

## 6. Acessibilidade (checklist de design)

- [ ] Contraste texto/fundo ≥ 4.5:1 (corpo) e ≥ 3:1 (títulos ≥ 24px) — validar todos os tokens de cor.
- [ ] Alvos de toque ≥ 44×44px (projeto adota 48px).
- [ ] Foco visível em todos os interativos (input, botões, itens de lista, form da US-10).
- [ ] Estado nunca comunicado só por cor (sempre ícone + texto).
- [ ] `inputmode="numeric"` e label persistente no telefone.
- [ ] Ordem de leitura lógica para leitor de tela; mensagens de erro associadas ao campo (`aria-describedby`).
- [ ] Texto redimensionável sem quebra (testar 200%).
- [ ] Linguagem simples, frases curtas, sem jargão técnico (cognitive accessibility).
- [ ] Áreas tocáveis não sobrepostas; botão primário longe de gestos de borda.

---

## 7. Microcopy (fonte única da verdade)

Reaproveitar **literalmente** os textos da Especificação §6 e PRD §5 (evita retrabalho e mantém o tom). Centralizar todas as strings em uma tabela de copy no Figma para revisão de um líder (critério de conclusão da Fase 3). Tom: caloroso, na 2ª pessoa, orientado à ação. Sempre dizer **o que fazer a seguir**.

---

## 8. Entregáveis de Design por Fase

O design vive na **Fase 3**, mas se prepara nas Fases 1–2 e se valida na Fase 4:

| Fase | Papel do design | Entregável |
|------|-----------------|------------|
| **Fase 1** (dados) | Mapear enums (Área/Turno/Função) e formatos que aparecem na UI (telefone, datas, horários) | Inventário de conteúdo + tabela de strings/enums |
| **Fase 2** (backend) | Alinhar telas aos estados do contrato de API (`state` + `error codes`) e payloads (campos exibidos: nome, área, função, carimbos, duração) | Mapa estado↔tela validado contra o contrato; lista de campos por tela |
| **Fase 3** (frontend) | **Produzir todas as telas, componentes, tokens e protótipo navegável**; rodar checklist de UX com ≥ 1 líder | Design system + 12 telas + protótipo + specs de handoff |
| **Fase 4** (piloto) | Observar uso real (entrada do culto, pressa, rede), medir tempo de check-in e ajustar | Anotações de usabilidade + lista priorizada de ajustes |

**Sugestão de sequência de produção no Figma:**
1. Tokens + componentes base (Button, Input, Card, Message).
2. Caminho feliz completo: T1 → T3 → T8 (check-in) e T4 → T8 (check-out). *É o que cobre ≥ 85% dos casos.*
3. Orientação/borda: T2a, T2b, T5, L, E, O.
4. SHOULD: T6 (MULTIPLE) e T7 (US-10).
5. Protótipo interativo ligando os fluxos + tabela de copy para validação com líder.

---

## 9. Decisões de Design

### 9.1 Confirmadas ✅

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Cor primária da marca | `#D3642A` terracota quente |
| 2 | Cor do botão check-in | `#16A34A` verde |
| 3 | Cor do botão check-out | `#2563EB` azul (distinto do verde) |
| 4 | Fundo de todas as telas | `#FFFFFF` branco puro |
| 5 | Fonte base | **Inter** (inclui inputs, botões — sem mono) |
| 6 | Toggle one-tap marcado por padrão | **Sim**, com microcopy de privacidade |
| 7 | Header sem linha divisória | **Sim** — branco contínuo com o conteúdo |
| 8 | Marca no header | Centralizada; com "‹ Voltar" à esq. quando há navegação |
| 9 | Identity card na T3 | **Removido** (decisão do stakeholder) |
| 10 | Tamanho do texto dos botões primários | **20px / 700** (T1 "Buscar" = T3 "Confirmar Check-in") |
| 11 | Copy de boas-vindas em T1 | "Bem-vinda(o)!" · "Confirme sua presença como voluntário" + linha de data |

### 9.2 Pendentes (não bloqueiam produção das demais telas)

1. **US-10 entra no piloto?** Define se T7 e o botão em T2b aparecem na Fase 3/4 (Dúvida 10 do PRD).
2. **Origem da lista de Função na US-10** (texto livre vs seletor) — Pendência §16.6 da Especificação.
3. **Janelas de turno confirmadas?** Se não, T6 (MULTIPLE) aparece mais — cuidado redobrado com esse design (Dúvida 7 do PRD).
4. **Exibir duração no check-out e no DONE?** Recomendado — reforça sensação de serviço cumprido.

---

## 10. Progresso de Produção (FlutterFlow Designer)

> Design produzido via MCP `flutterflow-designer` — design "Central Ser Amor" no FlutterFlow.

| Tela | Status | Observações |
|------|--------|-------------|
| T1 · Captura telefone | ✅ Produzida | Copy, campo 64px, botão 56px/20px/700, header 72px |
| T3 · CAN_CHECKIN | ✅ Produzida | Sem identity card (intencional); header com "‹ Voltar" + marca centralizada |
| T8 · Sucesso check-in | ✅ Produzida | Card resumo, reforço one-tap, link "Sair" |
| L · Loading | 🔲 A fazer | |
| E · Erro/Timeout | 🔲 A fazer | |
| O · Offline | 🔲 A fazer | |
| T2a · NOT_FOUND | 🔲 A fazer | |
| T2b · NOT_SCHEDULED | 🔲 A fazer | |
| T4 · IN_SERVICE | 🔲 A fazer | |
| T5 · DONE | 🔲 A fazer | |
| T6 · MULTIPLE | 🔲 A fazer | |
| T7 · US-10 | 🔲 A fazer | Depende da decisão §9.2 item 1 |

---

*Descritivo de design v1.1 (jun/2026) — tokens aprovados, caminho feliz produzido. Próximos passos: estados transversais L/E/O, orientação/terminais T2a/T2b/T4/T5, SHOULD T6/T7.*
