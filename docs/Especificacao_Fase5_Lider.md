# Especificação + Wireframes — Fase 5 (Visão de Ambiente / Líder)
## Sistema de Check-in de Voluntários · Igreja Ser Amor
**Versão:** 0.4 (combo de período, data de início, popover do card + confirmar excluir) | **Escopo:** Painel `/area` — 3 abas | **Base:** PRD v1.3, Especificação Fases Futuras §2, Fase 6 (Admin) já no ar, Contrato v1.2 | **Data:** Jun/2026

> Refino da Fase 5 do doc de *Fases Futuras* (§2). O objetivo vago original
> ("dashboard em tempo real + gestão de escala") foi reorganizado em **3 objetivos
> de gestão da liderança de uma área**:
> **(1) Visão** — visibilidade da equipe; **(2) Voluntários** — CRUD; **(3) Escalas** —
> criar/ver/editar. As telas de **Escalas** seguem as referências visuais enviadas
> (ABA Escala / Nova Escala / Adicionar Participantes).
>
> A Fase 5 **reaproveita a infra da Fase 6** (Zero Trust, `adminClient`, `DatePicker`,
> tokens de marca, mapa Área→spreadsheetId no `Admin.gs`). Marcações `[A DEFINIR]`
> seguem o estilo dos specs anteriores e devem ser resolvidas em discovery.

---

## 1. Visão Geral

| Item | Decisão |
|------|---------|
| **Persona** | Líder de Ministério — responsável por **uma área** (Louvor, Acolhimento…). Monta a escala e acompanha a saúde da equipe. |
| **JTBD** | *"Quando monto a escala da minha área, preciso ver quem está pouco/muito escalado e manter o cadastro, sem depender do admin nem editar planilha."* |
| **Onde mora** | **Mesmo projeto** React (Vite + TS + Tailwind), em rota **`/area`** (3º entrypoint, junto de `/` e `/admin`) |
| **Backend** | **Mesmo Apps Script**; novos `action`s `area*`; mesmas planilhas |
| **Autenticação** | **Cloudflare Zero Trust** na rota `/area` (grupo Líderes) + mapa `email→área` (aba `Acessos`) |
| **Marca / título** | Header **padrão `/admin`**, **uma linha só**: ❤ + **nome da área** (no lugar de "Base Voluntários"; vira **seletor** quando >1 área) + **Sair**. **Sem mês/período no header.** E-mail vira saudação **"Olá, _Nome_"** (Nome vem da aba `Acessos`) no topo do conteúdo |
| **Navegação** | **Bottom nav** mobile com 3 abas: **Visão · Voluntários · Escalas** |
| **Escopo de dados** | **1 área** (a do líder), ≠ Fase 6 que é global |

**Fase 5 × Fase 6 (complementares):**

| | Fase 5 — Líder (`/area`) | Fase 6 — Admin (`/admin`, no ar) |
|---|---|---|
| Escopo | 1 área | Todas as áreas |
| "Visão" | **Saúde da equipe** (carga de escala, cadastro) | Operação do dia (check-in em tempo real) |
| Abas | Visão · Voluntários · Escalas | Visão · Serviço · Cadastro |

> A **Visão do líder NÃO é o painel de check-in em tempo real** (isso é do admin). É a
> leitura de **distribuição de carga + cadastro** da equipe.

---

## 2. Acesso e Segurança

Separa **autenticação** (quem é) de **autorização** (quais áreas gerencia). É **N:N**:
um líder pode ter >1 área e uma área pode ter >1 líder.

### 2.1 Autenticação — Zero Trust (gate de identidade)
- Rota `/area` (e o asset que a serve) atrás de **policy do Cloudflare Access**: só
  e-mails do grupo **Líderes**. Sem allowlist no código (mesmo padrão do `/admin`).
- O app lê a identidade via **`/cdn-cgi/access/get-identity`** → `operador` (e-mail).
- O ZT prova **quem** é o operador, **não** quais áreas ele gerencia.

### 2.2 Autorização — mapa `email→área` (proposta: Opção A)
Premissa N:N. Três opções avaliadas; **recomendada = A**:

| Opção | Como | Prós | Contras |
|-------|------|------|---------|
| **A (recomendada)** | Aba **`Acessos`** na planilha Base (onde mora `Base Voluntarios`) | Secretaria edita; N:N trivial; cacheável; histórico na planilha | E-mail precisa bater com o do Google/ZT; manter a aba |
| B | Grupos do Cloudflare Access (1 grupo/área); `get-identity` devolve grupos → grupo→área | Authz unificada na auth; nada na planilha | Gestão no dashboard Cloudflare (técnico); expor grupos no identity |
| C | `Script Properties` JSON `email→[áreas]` | Sem leitura de planilha; rápido | Editar exige acesso ao Apps Script (dev); sem histórico |

**Opção A — schema da aba `Acessos` (1 linha por par):**

| Email | Área | Ativo? | Nome *(opcional)* |
|-------|------|--------|-------------------|
| maria@…seramor.com.br | Louvor | SIM | Maria |
| maria@…seramor.com.br | Som | SIM | Maria |
| joao@…seramor.com.br | Louvor | SIM | João |

- Maria em 2 áreas = 2 linhas; Louvor com 2 líderes = 2 linhas. `Ativo? = NÃO` desliga
  o acesso sem apagar a linha. (Variante compacta: 1 linha por pessoa com `Áreas`
  separadas por `;` — menos legível na planilha, escolhida a row-per-par.)
- `Área` deve ser um dos **11 nomes** já mapeados em `Admin.gs` (Área→spreadsheetId).

**Resolução server-side:** `resolveAreas_(email)` lê a aba `Acessos` (cache, como as
demais leituras) e devolve as áreas com `Ativo? = SIM`. **Conjunto vazio ⇒ "Não
autorizado."** Mesmo confiando no `operador` (postura da Fase 6), a **aba é a
autorização**: toda `action` `area*` recebe um param `area` e valida que ele ∈ áreas do
operador antes de ler/gravar.

### 2.3 Comportamento multi-área (front)
- Bootstrap `areaMe` (ou claim no header do bundle) → `{ operador, areas: [...] }`.
- **1 área** → entra direto, header mostra o nome da área.
- **>1 área** → **seletor de área no header** (e/ou tela inicial de escolha); última
  área usada persistida em `localStorage`. O `area` selecionado vai como param em todas
  as actions.

### 2.4 Backend / regras
- **Token compartilhado** (reforço, igual Fase 6); a trava real é o Zero Trust.
- Regra do PRD mantida: **permissões/compartilhamento de planilha são manuais**, não pelo app.

### 2.5 Header (padrão `/admin`, com nome da área)
Reaproveita o header da Fase 6, trocando **"Base Voluntários"** pelo **nome da área**.
**Header tem uma linha só** (sem mês/período):
- ❤ (logo) + **nome da área** + **Sair**. Com **1 área**, o nome é texto fixo; com
  **>1 área**, vira **seletor** (chevron) que abre a lista de áreas do operador (a atual
  com ✓). Última área usada em `localStorage` (§2.3).
- **E-mail não fica no header:** vira saudação **"Olá, _Nome_"** no topo do conteúdo da
  Visão (Nome lido da aba `Acessos`; cai no e-mail só se faltar).
- Título do conteúdo ("Voluntários", "Escalas") desce para o corpo (a identidade da aba
  vem do **bottom nav**).
- O **período** (Ano/mês) **não** fica no header — vive na seção *Carga de escala* (§4).

---

## 3. Funcionalidades e User Stories

| # | Funcionalidade | User Story |
|---|----------------|-----------|
| **F5-A** | **Visão** (saúde da equipe) | **US-L1 (MUST):** Como líder, quero ver o total da equipe e a **carga de escala** de cada voluntário no período, para rebalancear quem está pouco/muito escalado. |
| **F5-B** | **Voluntários** (CRUD) | **US-L2 (MUST):** Como líder, quero **cadastrar, editar, mudar status** (ativo/inativo) e corrigir telefone/função dos voluntários da minha área, sem editar planilha. |
| **F5-C** | **Escalas** (criar/ver/editar) | **US-L3 (MUST):** Como líder, quero **criar e editar escalas** (data, turno, participantes) da minha área, para montar a operação do culto. |

**Decisões fixadas (stakeholder, jun/2026):**
- **Escala "Rascunho/Fechada" é só organizacional** — **não** controla o check-in do
  voluntário no app do MVP. O check-in segue valendo para qualquer escalado,
  independente do status. (`Fechada` = sinaliza ao líder que a escala está pronta.)
- **Gravação na planilha-de-origem da área** (aba `Voluntários`); a consolidação
  reconcilia para `Base Voluntarios`. Resolve o `[A DEFINIR]` "origem vs consolidada"
  do doc de fases futuras → **origem**.
- **Navegação = bottom nav** (3 abas).

---

## 4. F5-A · Aba Visão (saúde da equipe)

```
┌──────────────────────────────┐
│ ❤ Louvor ▾              Sair  │  header (1 linha, sem mês)
│ Olá, Maria                    │  saudação (Nome da aba Acessos)
│ ─────────────────────────────│
│ ┌────────────┐ ┌────────────┐ │
│ │Voluntários │ │ Ativos     │ │  metric cards 2×2
│ │    24      │ │    21      │ │
│ └────────────┘ └────────────┘ │
│ ┌────────────┐ ┌────────────┐ │
│ │Escalas/mês │ │Média/vol.  │ │  (acompanham o período; default mês)
│ │    12      │ │    4,2     │ │
│ └────────────┘ └────────────┘ │
│                              │
│ Carga de escala               │  título
│ [Período: Junho ▾] [Carga ↓]  │  combo período (default mês atual) + ordenação
│ ─────────────────────────────│
│ (AS) Ana Silva     8  muito  │  avatar · nome · barra · nº · badge
│      ▓▓▓▓▓▓▓▓▓▓               │  (badge vermelho)
│ ─────────────────────────────│
│ (CS) Carlos Santos 5 equilib.│  (badge verde)
│      ▓▓▓▓▓▓░░░░               │
│ ─────────────────────────────│
│ (JP) João Pereira  2  pouco  │  (badge âmbar)
│      ▓▓░░░░░░░░               │
│ ─────────────────────────────│
│ [ Visão ] [Voluntários][Escalas]│ ← bottom nav (Visão ativo)
└──────────────────────────────┘
```

| Elemento | Especificação |
|----------|---------------|
| Header | Padrão `/admin` (§2.5), 1 linha: ❤ + nome da área (seletor se >1) + Sair. **Sem mês.** Saudação **"Olá, _Nome_"** (Nome da aba `Acessos`) abre o conteúdo |
| Metric cards | Voluntários (total), Ativos, Escalas (no período), Média escalas/voluntário; arredondar números. Os 2 últimos **acompanham o período** escolhido na Carga |
| **Período da carga** | **Combo** ao lado da ordenação: **`Ano inteiro`** **ou** um **mês até o atual** (não lista meses futuros). **Default = mês atual.** Trocou os chips com scroll por combo (melhor UX) |
| Carga de escala | Lista por nº de escalas no período; barra relativa ao máximo; **badge**: `muito` (vermelho) · `equilibrado` (verde) · `pouco` (âmbar) |
| **Ordenação** | Botão alterna **`Carga ↓` (maior→menor)** e **`Carga ↑` (menor→maior)**. Default = maior |
| Tocar na linha | Abre o voluntário em **Voluntários** (cadastro) |

**Limiares de carga** `[A DEFINIR]`: thresholds de `pouco`/`muito` **configuráveis por
área** e **relativos ao período** (Ano vs. mês têm escalas diferentes). Default a confirmar.
**Dados:** agrega as escalas da área no período (count por voluntário) + cadastro.

---

## 5. F5-B · Aba Voluntários (CRUD)

### 5.1 Lista
```
┌──────────────────────────────┐
│ ❤ Louvor ▾              Sair  │  header da área (sem linha 2)
│ ─────────────────────────────│
│ Voluntários          [+ Novo] │  título do conteúdo + ação criar
│ [🔍 Buscar voluntário…       ]│  busca
│ (Todos)(Ativo)(Licença)(…) ↔ │  chips: Ativo/Licença/Treino/Inativo
│ ─────────────────────────────│
│ (AS) Ana Silva        [Ativo] ›│  avatar·nome·função·escalas·status
│      Vocal · 8 escalas        │
│ ─────────────────────────────│
│ (CS) Carlos Santos  [Licença] ›│
│      Guitarra · 5 escalas     │
│ ─────────────────────────────│
│ (RL) Rafael Lopes   [Inativo] ›│  inativo = esmaecido
│      Baixo · sem telefone     │
│ ─────────────────────────────│
│ [ Visão ][Voluntários][Escalas]│
└──────────────────────────────┘
```

### 5.2 Cadastro / edição
```
┌──────────────────────────────┐
│ ‹ Editar voluntário           │
│ Nome completo                 │
│ [ Ana Silva                  ]│
│ Telefone          Função      │
│ [(11) 99999-8888][ Vocal   ▾ ]│
│ Início            Time         │
│ [ 15/03/2024  📅][ Time A   ▾ ]│  data DD/MM/YYYY + time (opcional)
│ Status                        │
│ [✓ Ativo    ] [  Licença    ] │  4 opções (seleção única, 2×2)
│ [ Treinamento] [  Inativo   ] │
│  Só Ativo fica disponível      │
│ Observações                   │
│ ┌───────────────────────────┐ │
│ │ Disponível só aos domingos │ │  textarea ALTO (multilinha)
│ │                            │ │
│ │                            │ │
│ └───────────────────────────┘ │
│ ▓▓▓▓▓▓▓ Salvar ▓▓▓▓▓▓▓        │
└──────────────────────────────┘
```

| Campo | Regra |
|-------|-------|
| Nome | Obrigatório |
| Telefone | Opcional; ao salvar, **propaga origem + base + escala** (rotina `adminUpdatePhone` da Fase 6) |
| Função | Lista por área `[A DEFINIR]` |
| **Início** | Data de entrada do voluntário (**DD/MM/YYYY**, só data); grava na coluna `Inicio` da aba `Voluntários` (que já existe) |
| **Time** | **Opcional** — sub-grupo dentro da área (ex.: Time A/B); usado p/ filtrar em Participantes. Taxonomia `[A DEFINIR]` |
| **Status** | **4 opções (seleção única): `Ativo` · `Licença` · `Treinamento` · `Inativo`.** Só **Ativo** entra em novas escalas / "Disponíveis"; **nenhum** status remove de escalas já criadas. (Licença/Treinamento = temporários; tratamento fino `[A DEFINIR]`) |
| Observações | Livre, **multilinha** (campo alto) |
| Novo voluntário | Mesma tela, campos vazios; cria 1 linha na aba `Voluntários` da área |

---

## 6. F5-C · Aba Escalas (criar / ver / editar)

> Telas seguem as **referências visuais** enviadas (ABA Escala / Nova Escala /
> Adicionar Participantes).

### 6.1 Lista (ABA Escala)
```
┌──────────────────────────────┐
│ ❤ Louvor ▾              Sair  │  header da área (sem linha 2)
│ ─────────────────────────────│
│ Escalas              [+ Nova ] │  título do conteúdo + ação criar
│  Próximas        Anteriores   │  abas
│ (Todos) ( Manhã )( Noite )    │  chips de turno
│ ─────────────────────────────│
│ (15) Domingo     [Manhã]  ⋮   │  ⋮ = menu do card
│      15 de junho, 2026        │
│      👥 8 escalados · Rascunho │
│            ┌──────────────┐   │  popover POR CIMA (não empurra):
│ (22) Domin │ ⧉ Duplicar   │   │
│      22 de │ ✎ Editar     │   │
│      👥 6  │ 🗑 Excluir    │   │
│            └──────────────┘   │
│      22 de junho, 2026        │
│      👥 6 escalados · Fechada  │
│ ─────────────────────────────│
│ [ Visão ][Voluntários][Escalas]│
└──────────────────────────────┘
```

**Menu `⋮` (UX):** disparado pelo **menu `⋮`** do card (visível/descobrível); long-press
fica como **atalho secundário opcional**. O menu **abre como popover SOBRE os itens
abaixo** — não empurra/expande a lista.
- **Duplicar:** abre a *Nova Escala* pré-preenchida com **mesmo turno + participantes**,
  **nova data** (a escolher) e status de volta a **`Rascunho`**.
- **Editar:** abre a escala em edição.
- **Excluir:** pede **confirmação** num diálogo ("Excluir escala?" + resumo da escala +
  **Cancelar / Excluir**) antes de remover. Ação destrutiva em `error` (vermelho).

### 6.2 Nova/Editar escala — aba Detalhes
```
┌──────────────────────────────┐
│ ‹ Nova escala                 │
│  Detalhes      Participantes  │  abas
│ Data                          │
│ [ 15/06/2026             📅 ] │  DatePicker
│ Turno                         │
│ [  Manhã  ] [   Noite   ]     │  seleção única
│ Observações                   │
│ [ Adicione observações…      ]│
│ Status                        │
│ [▣ Rascunho] [🔒 Fechada]     │  só organizacional
│  "Fechada = escala pronta;     │
│   não altera o check-in."      │
└──────────────────────────────┘
```

### 6.3 Aba Participantes (= Adicionar Participantes)
```
┌──────────────────────────────┐
│ ‹ Participantes               │
│ [🔍 Buscar participantes…    ]│
│ (Todos)(Time A)(Time B)    ↔ │  filtro por Time (só quando houver)
│ Selecionar todos       (——●)  │  toggle geral
│ ─── PARTICIPANTES (24) ───────│
│ (AS) Ana Silva         (●——)  │  on
│      Vocal · Time A            │  (sem "Disponível/Já escalado")
│ ─────────────────────────────│
│ (CS) Carlos Santos     (——●)  │  off
│      Guitarra · Time A         │
│ ─────────────────────────────│
│ (JP) João Pereira      (——●)  │  off
│      Teclado · Time B          │
│ ─────────────────────────────│
│ ▓ Salvar escala · 1 selec. ▓  │
└──────────────────────────────┘
```

| Elemento | Especificação |
|----------|---------------|
| Card da lista | Badge de data + dia da semana + turno (Manhã âmbar / Noite azul) + nº escalados + status + **menu `⋮`** |
| **Menu `⋮` do card** | **Duplicar · Editar · Excluir** (ver §6.1) |
| Status | `Rascunho` (âmbar) / `Fechada` (verde) — **só organizacional**, não toca no check-in |
| Turno | Seleção única Manhã/Noite (grava em `Período` da aba origem) |
| **Filtro por Time** | Chips por **Time** quando a área tiver times (senão, **oculto**). Filtra a lista de participantes |
| Linha do participante | Mostra **nome · função (· Time)** — **sem** rótulo "Disponível/Já escalado" |
| Conflito (mesmo dia/turno) | **Não é mais exibido** na linha; tratamento `[A DEFINIR]` (bloquear ao salvar? só avisar? ignorar) |
| Selecionar todos | Marca todos os participantes do **filtro atual** |
| Salvar | Persiste 1 linha por participante na aba `Voluntários` da área (`Data, Voluntário, Período, Função, Telefone, Observações`) |

---

## 7. Extensão do Contrato de API (previsão)

Novos `action`s no mesmo Apps Script, todos exigindo `token` + `operador`; exceto
`areaMe`, recebem o param **`area`** e são **escopados** — o backend valida que `area`
∈ áreas do operador (aba `Acessos`, §2.2) antes de qualquer leitura/gravação.

| `action` | Função |
|----------|--------|
| `areaMe` | Bootstrap: `{ operador, nome, areas:[...] }` (nome p/ saudação + áreas do operador) |
| `areaVisao` | Agregação: totais + carga por voluntário no **período** (`Ano` ou mês até o atual) + ordenação |
| `areaVoluntarioList` | Voluntários da área (busca + filtro de status: Ativo/Licença/Treinamento/Inativo) |
| `areaVoluntarioUpsert` | Cria/edita voluntário (nome, telefone, função, **início**, **time**, status, obs.) |
| `areaVoluntarioStatus` | Muda status (`Ativo`/`Licença`/`Treinamento`/`Inativo`) |
| `areaEscalaList` | Escalas da área (próximas/anteriores, filtro de turno) |
| `areaEscalaGet` | Detalhe de 1 escala (participantes) — base do **Duplicar** |
| `areaEscalaUpsert` | Cria/edita/**duplica** escala (data, turno, obs., status, participantes) |
| `areaParticipantes` | Voluntários da área p/ escalar (**ativos**; filtro por `time`; conflito `[A DEFINIR]`) |

Gravação em **planilha-de-origem da área** (aba `Voluntários`); consolidação
reconcilia para `Base Voluntarios`. Concorrência: last-write-wins sob `LockService`.

---

## 8. Riscos e Pendências de Discovery

| Item | Tipo | Observação |
|------|------|------------|
| Mapa `email→área` | ✅ Confirmado | **Opção A** (aba `Acessos`, §2.2); criar a aba (com coluna `Nome`) |
| Limiares de carga (pouco/muito) | Definição | Default + configurável por área; **relativos ao período** (Ano vs. mês) |
| Lista de funções por área | Definição | Origem da taxonomia de funções |
| **Times por área** | Definição | Existem? Taxonomia e onde gravar (atributo do voluntário) — habilita o filtro em Participantes |
| **Conflito de dupla-escala** | Técnico | Sem exibição na linha; decidir se bloqueia ao salvar, só avisa ou ignora (e se cruza áreas) |
| Edição concorrente de escala | Técnico | Last-write-wins vs. lock — confirmar |
| Reconciliação origem→consolidada | Técnico | Garantir que a consolidação preserve o que o líder gravou |

---

## 9. Reaproveitamento da Fase 6

`src/api/adminClient.ts` (+ mock toggle `VITE_*`), `DatePicker.tsx`, `zeroTrust.ts`
(getIdentity/logout), tokens de marca, e o **mapa Área→spreadsheetId** já no `Admin.gs`.
Estrutura espelhada: `src/area/` (AreaApp, AreaShell, AreaSwitcher, VisaoScreen,
VoluntariosScreen, EscalasScreen + EscalaForm), `src/types/area.ts`. Roteamento por path
em `src/main.tsx` (`/area`→AreaApp). Backend: novo `Area.gs` (espelha `Admin.gs`,
reusa CONFIG/helpers + `resolveAreas_`).

---

*Refino da Fase 5 (Líder). Os `[A DEFINIR]` devem ser resolvidos em discovery antes da
implementação. Acompanha a Especificação Fase 6 (Admin) e o doc de Fases Futuras.*
