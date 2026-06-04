# Wireframes Textuais — Telas do MVP (Fases 1–4)
## Sistema de Check-in de Voluntários · Igreja Ser Amor
**Versão:** 1.0 | **Companheiro de:** Descritivo de Design de Telas v1.0 | **Base:** Especificação MVP + PRD v1.3 | **Data:** Jun/2026

> Wireframes de baixa/média fidelidade em texto. Cada tela traz: **(1)** layout visual ASCII, **(2)** anatomia campo a campo, **(3)** comportamento/estados e **(4)** dados consumidos do contrato de API. Medidas em viewport mobile de referência **360–390px** de largura. Use como blueprint direto para o Figma.

---

## Convenções

```
┌─────────┐   moldura = viewport do aparelho (~390px)
│         │   ▓▓▓ = botão primário (largura total, fixo embaixo)
│         │   ░░░ = botão secundário / ghost
[ campo ] = input          ( ) = radio / toggle off   (●) = toggle on
▸ = item de lista tocável   ⟳ = spinner   ✓ ⚠ ⊘ = ícones de status
```

**Estrutura comum (todas as telas):**
```
┌──────────────────────────────┐
│  [zona segura topo / status] │
│  HEADER (marca · ação sair)  │  ← 56px, fixo
│ ─────────────────────────────│
│                              │
│  CONTEÚDO (1 foco)           │  ← rola se preciso
│                              │
│ ─────────────────────────────│
│  ▓▓▓ AÇÃO PRIMÁRIA ▓▓▓        │  ← fixo, 48px, margem 16px
│  ░ ação secundária (link) ░  │
│  [zona segura inferior]      │
└──────────────────────────────┘
```

---

## T1 · Entrada — Captura de telefone (US-01)

```
┌──────────────────────────────┐
│  ❤ Ser Amor                   │  HEADER
│ ─────────────────────────────│
│                              │
│        ❤                      │  marca/ilustração (≤120px)
│                              │
│   Bem-vindo!                  │  H1 28px bold
│   Confirme sua presença       │  subtítulo 16px secondary
│                              │
│   Seu telefone                │  label 14px (persistente)
│   ┌────────────────────────┐ │
│   │ (11) 99999-8888        │ │  input 56px · inputmode numeric
│   └────────────────────────┘ │  · foco automático · máscara
│   Digite os 11 dígitos com    │  helper 13px (vira erro se inválido)
│   DDD                         │
│                              │
│ ─────────────────────────────│
│   ▓▓▓▓▓▓ Buscar ▓▓▓▓▓▓▓       │  primary · disabled até 11 díg.
└──────────────────────────────┘
```

| Elemento | Especificação |
|----------|---------------|
| Header | Marca "Ser Amor", sem botão "sair" (ainda não há sessão) |
| Marca central | Logo/ícone, opcional, leve (não atrasar carregamento) |
| Título | "Bem-vindo!" + "Confirme sua presença" |
| Label | "Seu telefone" — **sempre visível**, não só placeholder |
| Input | Altura 56px; `inputmode="numeric"`; máscara `(XX) XXXXX-XXXX`; foco automático ao abrir; placeholder de exemplo |
| Helper/erro | Neutro: "Digite os 11 dígitos com DDD". Erro: vira vermelho "Número incompleto" |
| Botão Buscar | Primary, largura total, **desabilitado** até 11 dígitos válidos |

**Comportamento:** ao tocar Buscar → estado `loading` no botão (⟳, desabilitado) → normaliza (remove não-dígitos e `55` inicial) → `POST resolve`. **One-tap:** se há telefone salvo cifrado, esta tela **não é renderizada** — vai direto ao Loading.
**API:** envia `{ telefone }` → recebe `state`.

---

## T2a · NOT_FOUND — Não cadastrado (US-02)

```
┌──────────────────────────────┐
│  ❤ Ser Amor                   │
│ ─────────────────────────────│
│                              │
│         ⊘                     │  ícone info/neutro 64px
│                              │
│   Número não encontrado       │  H2 24px
│                              │
│   Não encontramos este número │  corpo 16px
│   na nossa base de            │
│   voluntários. Por favor,     │
│   procure o líder do seu      │
│   ministério para atualizar   │
│   seu cadastro.               │
│                              │
│ ─────────────────────────────│
│   ░░ Tentar outro número ░░   │  secondary → volta a T1
└──────────────────────────────┘
```

| Elemento | Especificação |
|----------|---------------|
| Ícone | ⊘ neutro/erro suave — **não alarmante** |
| Título | "Número não encontrado" |
| Corpo | Texto **literal** da spec (§6 NOT_FOUND) |
| Ação | Apenas secundária "Tentar outro número" → T1 limpo. **Sem ação de gravação** |

**Comportamento:** estado terminal de orientação. Não há one-tap salvo aqui (telefone inválido não é persistido).
**API:** `state = NOT_FOUND` (sem `data.nome`).

---

## T2b · NOT_SCHEDULED — Cadastrado, sem escala (US-03)

```
┌──────────────────────────────┐
│  ❤ Ser Amor      Usar outro ▸ │
│ ─────────────────────────────│
│                              │
│         ⚠                     │  ícone atenção 64px
│                              │
│   Olá, Maria!                 │  H2 24px (nome do contrato)
│                              │
│   Não localizamos você na     │  corpo 16px
│   escala de hoje. Caso tenha  │
│   sido escalado, procure o    │
│   líder do ministério.        │
│                              │
│ ─────────────────────────────│
│  ░ Vou servir hoje mesmo ░    │  secondary → T7 (se US-10 ON)
│  ░░░ assim ░░░                │
└──────────────────────────────┘
```

| Elemento | Especificação |
|----------|---------------|
| Header | Inclui link "Usar outro número" |
| Nome | "Olá, **[Nome]**!" — vem de `data.nome` |
| Corpo | Texto literal (§6 NOT_SCHEDULED) |
| Ação condicional | "Vou servir hoje mesmo assim" → T7. **Só aparece se US-10 habilitada.** Se desligada, ocultar e manter apenas a orientação |

**API:** `state = NOT_SCHEDULED`, `data.nome` presente.

---

## T3 · CAN_CHECKIN — Confirmar entrada (US-04) ⭐ caminho feliz

```
┌──────────────────────────────┐
│  ❤ Ser Amor      Usar outro ▸ │
│ ─────────────────────────────│
│                              │
│   Olá, Maria!                 │  saudação H2 24px
│                              │
│  ┌────────────────────────┐  │  IDENTITY CARD
│  │  📍 Ministério           │  │
│  │     LOUVOR              │  │  área 22px bold
│  │  ──────────────────     │  │
│  │  Função                 │  │
│  │     Vocal               │  │  função 18px
│  └────────────────────────┘  │
│                              │
│   Confirmar entrada no        │  pergunta 16px
│   Ministério Louvor como      │
│   Vocal?                      │
│                              │
│   (●) Salvar meus dados       │  toggle one-tap (US-06)
│       neste aparelho          │  + microcopy privacidade
│ ─────────────────────────────│
│  ▓▓ ✓ Confirmar Check-in ▓▓   │  PRIMARY VERDE (action/checkin)
└──────────────────────────────┘
```

| Elemento | Especificação |
|----------|---------------|
| Saudação | "Olá, [Nome]!" |
| Identity Card | Destaque para **Área** (Ministério) e **Função**; legível à distância de braço |
| Pergunta | Texto literal (§6 CAN_CHECKIN) com Área e Função interpolados |
| Toggle one-tap | "Salvar meus dados neste aparelho" — **default marcado** (recomendado, ver decisão §9.2 do Descritivo) + microcopy: "Seu telefone fica salvo só neste aparelho. Você pode remover depois." |
| Botão | **Verde** (`action/checkin`), ícone ✓, largura total, fixo |

**Comportamento:** toque → `loading` no botão → `POST checkin {telefone, data, area, turno}` → T8 (sucesso check-in). Se one-tap marcado, persiste telefone cifrado no sucesso.
**API:** `state = CAN_CHECKIN`; `data = { nome, area, funcao, turno, dataEscala }`.

---

## T4 · IN_SERVICE — Confirmar saída (US-05)

```
┌──────────────────────────────┐
│  ❤ Ser Amor      Usar outro ▸ │
│ ─────────────────────────────│
│                              │
│   Olá, Maria!                 │
│                              │
│  ┌────────────────────────┐  │  IDENTITY CARD (variante)
│  │  📍 Ministério Louvor    │  │
│  │  ──────────────────     │  │
│  │  ⏱ Entrada às 09:50     │  │  horário destacado
│  └────────────────────────┘  │
│                              │
│   Você entrou às 09:50.       │  texto literal
│   Confirmar saída do          │
│   Ministério Louvor?          │
│                              │
│ ─────────────────────────────│
│  ▓▓ Confirmar Check-out ▓▓    │  PRIMARY (action/checkout, cor
│                              │  distinta do check-in)
└──────────────────────────────┘
```

| Elemento | Especificação |
|----------|---------------|
| Identity Card | Variante "em serviço": Área + **horário de entrada** (⏱) |
| Pergunta | Texto literal (§6 IN_SERVICE) com hora e Área |
| Botão | `action/checkout` — **cor distinta** do verde de check-in para não confundir ação |

**Comportamento:** toque → `loading` → `POST checkout {telefone, data, area, turno}` → T8 (sucesso check-out com duração).
**API:** `state = IN_SERVICE`; `data = { nome, area, checkinAt }`. Resposta do checkout traz `duracaoMin`.

---

## T5 · DONE — Serviço concluído (US-05)

```
┌──────────────────────────────┐
│  ❤ Ser Amor      Usar outro ▸ │
│ ─────────────────────────────│
│                              │
│         ✓                     │  ícone sucesso 72px (success)
│                              │
│   Olá, Maria!                 │  H2 24px
│   Seu serviço de hoje já      │
│   está completo.              │
│   Obrigado por servir! ❤      │  tom de gratidão
│                              │
│  ┌────────────────────────┐  │  resumo (read-only)
│  │  Entrada      09:50     │  │
│  │  Saída        12:15     │  │
│  │  Duração      2h25      │  │  (se exibir duração)
│  └────────────────────────┘  │
│                              │
│ ─────────────────────────────│
│  ░ Sair / Usar outro número ░ │  link discreto (limpa one-tap)
└──────────────────────────────┘
```

| Elemento | Especificação |
|----------|---------------|
| Ícone | ✓ grande, cor `feedback/success` |
| Mensagem | Texto literal (§6 DONE) — tom celebrativo |
| Resumo | Entrada, Saída e (opcional) Duração — read-only |
| Ação | **Sem botão primário.** Só link "Sair / Usar outro número" → limpa localStorage |

**API:** `state = DONE`; `data = { nome, checkinAt, checkoutAt, duracaoMin }`.

---

## T6 · MULTIPLE — Seleção de escala (US-07)

```
┌──────────────────────────────┐
│  ❤ Ser Amor      Usar outro ▸ │
│ ─────────────────────────────│
│                              │
│   Olá, Maria!                 │
│   Você está escalado em mais  │  título 18px
│   de uma área hoje.           │
│   Selecione:                  │
│                              │
│  ┌────────────────────────┐  │
│  │ ▸ LOUVOR               │  │  item tocável ≥56px
│  │   Manhã · Vocal        │  │  Área · Turno · Função
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ ▸ ACOLHIMENTO          │  │
│  │   Manhã · Recepção     │  │
│  │   🟡 Em serviço         │  │  selo se já tem check-in
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ ▸ MULTIMÍDIA           │  │
│  │   Noite · Projeção     │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

| Elemento | Especificação |
|----------|---------------|
| Título | "Você está escalado em mais de uma área hoje. Selecione:" (literal §6) |
| Item de lista | Cartão tocável ≥56px; **Área (destaque) · Turno · Função**; selo de status se a linha já tem `In=TRUE` (🟡 Em serviço) ou `Out=TRUE` (🔵 Concluído) |
| Sem botão fixo | A própria lista é a ação |

**Comportamento:** tocar um item → resolve aquela linha (chave `Telefone+Data+Área+Turno`) → navega ao estado correspondente (T3 se `CAN_CHECKIN`, T4 se `IN_SERVICE`, T5 se `DONE`).
**Acessibilidade:** itens como `role="button"`/lista navegável por teclado e leitor de tela.
**API:** `state = MULTIPLE`; `data.opcoes = [{ area, turno, funcao, estadoLinha }, …]`.

---

## T7 · US-10 — Presença fora da escala (SHOULD)

```
┌──────────────────────────────┐
│  ❤ Ser Amor          ◂ Voltar │
│ ─────────────────────────────│
│   Registrar presença          │  H2 24px
│   Você não está na escala de  │  contexto 14px secondary
│   hoje. Informe os dados:     │
│                              │
│   Área *                      │  label
│   ┌────────────────────────┐ │
│   │ Selecione…           ▾ │ │  SELECT (enum oficial)
│   └────────────────────────┘ │
│                              │
│   Função *                    │
│   ┌────────────────────────┐ │
│   │ Selecione…           ▾ │ │  SELECT ou texto (ver §9.4)
│   └────────────────────────┘ │
│                              │
│   Motivo *                    │
│   ┌────────────────────────┐ │
│   │ Ex.: substituindo      │ │  TEXTAREA obrigatório
│   │ Fulano, remanejado…    │ │
│   └────────────────────────┘ │
│                              │
│ ─────────────────────────────│
│  ▓▓▓ Confirmar presença ▓▓▓   │  disabled até 3 campos OK
└──────────────────────────────┘
```

| Campo | Especificação |
|-------|---------------|
| Header | "Voltar" → retorna a T2b |
| Área * | Select com enum **oficial**: Acolhimento, Central, Clubinho, Ekoe, Foto e Vídeo, Iluminação, Logística, Louvor, Multimídia, Som, Transmissão |
| Função * | Select ou texto livre (depende da origem da lista — §9.4 do Descritivo) |
| Motivo * | Textarea **obrigatório**; placeholder com exemplos |
| Botão | **Desabilitado** até Área + Função + Motivo preenchidos. Erro inline se motivo vazio (`MISSING_REASON`) |

**Pré-condição:** só acessível a partir de T2b (telefone cadastrado). Confirma → `loading` → `POST registerOutsideSchedule {telefone, area, turno, funcao, motivo}` → T8 (sucesso). Depois, check-out (T4) funciona normal.

---

## T8 · Sucesso — 3 variações (US-04/05/10)

```
┌──────────────────────────────┐        VARIAÇÃO check-in:
│  ❤ Ser Amor                   │        ✓ "Check-in confirmado!"
│ ─────────────────────────────│        Maria · Louvor · 09:50
│                              │
│         ✓                     │        VARIAÇÃO check-out:
│      (animação ≤400ms)        │        ✓ "Check-out confirmado!"
│                              │        Maria · Louvor · 2h25 servidas
│   Check-in confirmado!        │  H1
│                              │        VARIAÇÃO US-10:
│  ┌────────────────────────┐  │        ✓ "Presença registrada!"
│  │  Maria Silva           │  │        Maria · Louvor · 09:50
│  │  📍 Louvor              │  │
│  │  ⏱ Entrada 09:50        │  │  (check-out: + Duração)
│  └────────────────────────┘  │
│                              │
│   ✓ Seus dados ficaram        │  reforço se one-tap ativado
│     salvos neste aparelho     │
│ ─────────────────────────────│
│  ░ Sair / Usar outro número ░ │
└──────────────────────────────┘
```

| Variação | Título | Resumo |
|----------|--------|--------|
| Check-in | "Check-in confirmado!" | Nome · Área · horário de entrada |
| Check-out | "Check-out confirmado!" | Nome · Área · **duração** (entrada→saída) |
| US-10 | "Presença registrada!" | Nome · Área · horário |

| Elemento | Especificação |
|----------|---------------|
| Ícone | ✓ com microanimação **≤400ms**, não bloqueante |
| Card resumo | Confirma os dados gravados |
| Reforço one-tap | Só aparece se o toggle acabou de ativar o salvamento |
| Ação | Link "Sair / Usar outro número" |

---

## Estados Transversais

### L · Loading
```
┌──────────────────────────────┐
│  ❤ Ser Amor                   │
│ ─────────────────────────────│
│                              │
│            ⟳                  │  spinner centralizado
│                              │
│   Buscando sua escala…        │  microcopy honesto
│                              │  ("Confirmando…" na gravação)
└──────────────────────────────┘
```
- Fullscreen no `resolve`; **inline no botão** (⟳ + disabled) nas gravações para impedir duplo toque.
- Retry automático 1× em timeout (>5s), **silencioso**. Só após a 2ª falha → T-E.

### E · Erro / Timeout / Planilha indisponível
```
┌──────────────────────────────┐
│  ❤ Ser Amor                   │
│ ─────────────────────────────│
│         ⚠                     │
│   Algo deu errado             │  H2
│   Não conseguimos concluir    │
│   agora. Tente de novo em     │
│   instantes ou procure o      │
│   líder.                      │
│ ─────────────────────────────│
│  ▓▓▓ Tentar novamente ▓▓▓     │  primary → repete última ação
└──────────────────────────────┘
```
- **Nunca expor códigos** (`SHEET_UNAVAILABLE` etc.) — sempre linguagem humana.
- **Erros idempotentes não são erro:** `ALREADY_CHECKED_IN` → redireciona a T4; `ALREADY_CHECKED_OUT` → redireciona a T5. (não mostrar esta tela)

### O · Offline
```
┌──────────────────────────────┐
│  ❤ Ser Amor                   │
│ ─────────────────────────────│
│         ⚡̸                     │  ícone offline
│   Você está sem conexão       │  H2
│   Conecte-se e tente          │
│   novamente, ou procure o     │
│   líder.                      │
│ ─────────────────────────────│
│  ▓▓▓ Tentar novamente ▓▓▓     │
└──────────────────────────────┘
```

---

## Matriz Estado → Tela → API (referência rápida)

| `state` (resolve) | Tela | Ação primária | Endpoint da ação | Resultado |
|-------------------|------|---------------|------------------|-----------|
| — (input) | T1 | Buscar | `resolve` | → estado abaixo |
| `NOT_FOUND` | T2a | — (só voltar) | — | terminal |
| `NOT_SCHEDULED` | T2b | Vou servir (se US-10) | — → T7 | → US-10 |
| `CAN_CHECKIN` | T3 | Confirmar Check-in | `checkin` | → T8 |
| `IN_SERVICE` | T4 | Confirmar Check-out | `checkout` | → T8 (duração) |
| `DONE` | T5 | — | — | terminal |
| `MULTIPLE` | T6 | (selecionar item) | re-resolve linha | → T3/T4/T5 |
| (de T2b) | T7 | Confirmar presença | `registerOutsideSchedule` | → T8 |
| qualquer | L/E/O | Tentar novamente | repete | — |

---

## Ordem de Produção Recomendada (Figma)

1. **Caminho feliz** ⭐ (cobre ≥85%): T1 → T3 → T8(check-in); depois T4 → T8(check-out).
2. **Estados transversais:** L, E, O (reusados em tudo).
3. **Orientação/terminais:** T2a, T2b, T5.
4. **SHOULD:** T6 (MULTIPLE), T7 (US-10).
5. **Protótipo navegável** ligando os fluxos + tabela de copy para validar com ≥1 líder (critério de conclusão da Fase 3).

---

*Wireframes v1.0 — 12 telas/estados, campo a campo, alinhados ao Contrato de API v1.2 e à máquina de estados do MVP. Próximo passo sugerido: aprovar tokens de marca e converter o caminho feliz em alta fidelidade no Figma.*
