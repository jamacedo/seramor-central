# Especificação — Fases Futuras
## Sistema de Check-in de Voluntários · Igreja Ser Amor
**Versão:** 1.0 | **Escopo:** Fases 5–6 (Gestão e Governança) | **Data:** Mai/2026

Documento de visão para as fases pós-MVP. Menos detalhado que a fase atual de propósito — vários pontos exigem discovery e estão marcados com **[A DEFINIR]**. Acompanha a *Especificação Completa — Fase Atual (MVP)*.

---

## 1. Visão Geral

Depois que o check-in do voluntário (MVP) estiver rodando, a gestão se divide em duas camadas, lançadas em sequência:

- **Fase 5 — Visão de Ambiente (Líder):** autonomia para o líder coordenar sua própria área na ponta.
- **Fase 6 — Visão Central (Admin):** controle total, governança de dados e resolução de exceções em todas as áreas.

Ambas reaproveitam o mesmo backend (Apps Script) e o mesmo spreadsheet do MVP, adicionando rotas protegidas e novos endpoints. O App Sheet só é totalmente desativado ao fim da Fase 6, quando a gestão deixa de depender de planilha manual.

**Princípio de escopo:** lançar primeiro o que dá autonomia à ponta (líder), depois a governança central (admin). Não atrasar o MVP por conta da gestão.

---

## 2. Fase 5 — Visão de Ambiente (Líder)

### Objetivo
Dar ao líder de ministério visibilidade em tempo real e controle da escala da **sua própria área**.

### Persona
Líder de Ministério — responsável por uma área (ex.: Louvor, Acolhimento). Coordena a equipe durante o culto e monta a escala mensal.
**JTBD:** *"Quando coordeno o culto, preciso saber em tempo real quem chegou e quem falta, para acionar reservas ou redistribuir funções."*

### Funcionalidades
| Funcionalidade | Descrição |
|----------------|-----------|
| Dashboard em tempo real | Lista dos escalados da área no dia, com status: ✅ Presente · 🟡 Em serviço (check-in sem check-out) · ⬜ Pendente · 🔵 Encerrado |
| % de comparecimento | Indicador do dia para a área (presentes / escalados) |
| Gestão de escala | Adicionar/remover voluntários da escala da própria área [A DEFINIR: edita a planilha por área ou a consolidada?] |
| Filtro por turno/data | Visualizar Manhã/Noite e navegar por datas |

### User Stories
- **US-L1 (MUST):** Como líder, quero ver em tempo real quem fez check-in/out na minha área, para coordenar a equipe.
  - *Critério:* DADO acesso autenticado a `/lider`, QUANDO a página carrega, ENTÃO lista os escalados com status atualizado; novos check-ins refletem em tempo real (polling leve).
- **US-L2 (SHOULD):** Como líder, quero montar/editar a escala da minha área, para não depender do admin.
  - *Critério:* DADO escala da área, QUANDO o líder adiciona/remove um voluntário, ENTÃO a mudança reflete na próxima consolidação. [A DEFINIR: gravação direta vs. fila de aprovação]
- **US-L3 (COULD):** Como líder, quero ver o % de comparecimento histórico da minha área, para acompanhar tendências.

### Dados consumidos
- Leitura da aba `Checkin Ser Amor` filtrada pela área do líder.
- [A DEFINIR] Escrita na escala: definir se o líder edita a planilha da área (origem) ou a consolidada (e a consolidação reconcilia).

### Autenticação
Rota `/lider` protegida. Como o backend é Apps Script e a igreja usa Google: **login Google + allowlist de e-mails**, com mapeamento e-mail → área(s) que o líder pode ver/editar. [A DEFINIR] Onde mora esse mapeamento (aba de configuração na planilha?).

---

## 3. Fase 6 — Visão Central (Admin)

### Objetivo
Controle total sobre todas as áreas, governança da base de dados e resolução de exceções operacionais.

### Persona
Administrador da Igreja — secretaria/coordenação. Visão global, mantém a base e resolve casos que o líder não consegue.
**JTBD:** *"Quando garanto a operação de um culto, preciso de controle total sobre todas as áreas e resolver exceções sem depender de terceiros."*

### Funcionalidades
| Funcionalidade | Descrição |
|----------------|-----------|
| Visão global | Dashboard com status de **todas** as áreas simultaneamente |
| Gestão de voluntários | Adicionar/editar/inativar voluntários da base (atualização de telefones) |
| Override de escalas | Alterar a escala de qualquer área/ministério |
| Check-in/out manual | Buscar voluntário por nome e registrar entrada/saída por ele (plano B: celular sem bateria, quebrado, etc.) |
| Auditoria | Registro de quem fez o lançamento manual e quando |

### User Stories
- **US-A1 (MUST):** Como admin, quero registrar check-in/out por um voluntário sem celular, para cobrir exceções.
  - *Critério:* DADO acesso autenticado a `/admin`, QUANDO o admin busca pelo nome, ENTÃO exibe os escalados correspondentes; ao registrar, grava com auditoria (responsável = e-mail do admin; marcação de manual). [A DEFINIR: coluna de marcação — usar `Observações` ou coluna dedicada]
- **US-A2 (MUST):** Como admin, quero ver o status de todas as áreas num só painel, para garantir a operação do culto.
- **US-A3 (SHOULD):** Como admin, quero adicionar/editar/inativar voluntários, para manter a base sem editar planilha na mão.
- **US-A4 (SHOULD):** Como admin, quero alterar a escala de qualquer área, para resolver remanejamentos.

### Dados
- Leitura/escrita ampla na planilha (todas as áreas).
- **Atenção de segurança:** alterações de permissão/compartilhamento de planilhas **não** são feitas pelo app — devem ser feitas manualmente pelo responsável.

### Autenticação
Rota `/admin` protegida por **login Google + allowlist** (grupo "Administradores"). Separada da allowlist de líderes.

---

## 4. Autenticação das Rotas Restritas

Coerente com o backend Apps Script do MVP:
- **Login Google** (a igreja já usa Google) em vez de senhas próprias.
- **Allowlist por e-mail**, com dois grupos: Líderes (acesso à própria área) e Administradores (acesso total).
- Verificação do e-mail autenticado contra a allowlist a cada requisição às rotas restritas.
- [A DEFINIR] Local da allowlist e do mapa e-mail→área (provável: aba de configuração no spreadsheet).

> Alternativa, caso o frontend vá para hospedagem separada com Cloudflare: usar Cloudflare Zero Trust. A decisão acompanha a de hospedagem definida no MVP.

---

## 5. Extensão do Contrato de API (previsão)

Novos endpoints sobre o mesmo backend. Payloads a detalhar na fase de discovery.

| Endpoint (`action`) | Quem usa | Função |
|---------------------|----------|--------|
| `dashboard` | Líder/Admin | Status dos escalados (filtrado por área para líder; global para admin) |
| `manualCheckin` / `manualCheckout` | Admin | Registro manual com auditoria |
| `volunteerUpsert` / `volunteerDeactivate` | Admin | CRUD da base de voluntários |
| `scheduleEdit` | Líder/Admin | Edição de escala (escopo por área para líder) |

Todos passam a exigir **e-mail autenticado** + verificação de allowlist (ao contrário dos endpoints públicos do MVP).

---

## 6. Riscos e Dependências

| Risco / Dependência | Tipo | Observação |
|---------------------|------|------------|
| Resistência de líderes ao painel digital | Mudança | Piloto com 1–2 líderes campeões; onboarding presencial |
| Concorrência de escrita líder × consolidação | Técnico | Definir se edição de escala é direta ou reconciliada pela consolidação |
| Gestão de permissões/allowlist | Operacional | Manter allowlist e mapa e-mail→área atualizados |
| Edição simultânea de escala (2 pessoas) | Técnico | Last-write-wins ou lock; [A DEFINIR] |
| Latência do Apps Script em dashboards com polling | Técnico | Avaliar frequência de polling; migrar para Worker se necessário |

---

## 7. Pendências de Discovery

1. **Gestão de escala (US-L2/US-A4):** o líder/admin edita a planilha de área (origem) ou a consolidada? Como a consolidação reconcilia?
2. **Tempo real:** polling (intervalo?) ou outra abordagem para o dashboard?
3. **Marcação de check-in manual:** coluna dedicada ou `Observações`?
4. **Allowlist e mapa e-mail→área:** onde e como manter?
5. **Histórico/métricas:** quais relatórios o líder e o admin realmente precisam?
6. **Hospedagem/auth:** confirmar Google sign-in (Apps Script) vs Zero Trust (se Cloudflare), alinhado à decisão do MVP.

---

*Especificação das fases futuras (5–6). Os itens [A DEFINIR] devem ser resolvidos em discovery antes do início de cada fase. Acompanha a Especificação Completa — Fase Atual (MVP).*
