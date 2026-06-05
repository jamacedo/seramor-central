# PRD — Sistema de Check-in de Voluntários
## Igreja Ser Amor
**Versão:** 1.3 | **Status:** Pronto para detalhamento técnico | **Data:** Mai/2026

> 🛠️ **Addendum (Jun/2026):** mudanças e decisões da fase de implementação estão em [Ajustes_Fase_Implementacao.md](Ajustes_Fase_Implementacao.md) e **prevalecem** sobre este documento nos pontos indicados lá.

> **Mudanças da v1.3:** risco de sobrescrita eliminado (consolidação sempre preserva colunas de presença; chave única confirmada); adicionada decisão de arquitetura de backend (Apêndice B) — **recomendação: backend em Apps Script no MVP**, com migração reversível para Worker se necessário.
> **Mudanças da v1.2:** semântica de `In`/`Out` (flags) vs `Checkin`/`Checkout` (carimbos) definida; App Script mantém a consolidação; colunas de substituto fora do MVP; fluxo de presença fora da escala definido como SHOULD; máquina de estados simplificada pelas flags.
> **Mudanças da v1.1:** QR Code genérico (sem parâmetro de área); inferência de área/culto via telefone + data/hora; suporte a check-out no mesmo QR; remoção do KV Store; estrutura de dados alinhada às planilhas reais.

---

## 1. Sumário Executivo

- **Problema:** O controle de presença de voluntários hoje depende de planilhas Google Sheets + Google App Script + App Sheet, gerando fricção, falta de visibilidade em tempo real e dependência de uma ferramenta genérica que não atende à jornada do ministério.
- **Solução:** Substituir o App Sheet por uma SPA leve acessada via **QR Code único e genérico**. O voluntário informa apenas o telefone; o sistema infere nome, área, função e culto a partir da planilha consolidada cruzada com a data/hora atual — e oferece check-in **ou** check-out conforme o estado.
- **Métrica de sucesso:** Taxa de check-in digital ≥ 85% dos voluntários escalados por culto, com tempo médio de check-in < 15 segundos, em até 60 dias após o lançamento do MVP.

---

## 2. Problema e Evidências

### Contexto operacional atual
A Igreja Ser Amor já opera com **uma planilha por área** (com aba de Voluntários e abas mensais de Escala) e **uma planilha consolidada de check-in** que compila todas as escalas para registro de presença. As automações são feitas em Google App Script, e o App Sheet serve de interface. Isso funcionou como ponto de partida, mas trava a evolução:

| Problema | Impacto |
|----------|---------|
| App Sheet é genérico — UI não reflete a jornada do voluntário | Atrito no check-in; voluntários pedem ajuda aos líderes |
| Sem fluxo "one-tap" para recorrentes | Quem serve toda semana redigita dados |
| QR Code/fluxo exige saber área antecipadamente | Operação mais complexa do que precisa ser |
| Líderes sem visibilidade em tempo real | Não sabem quem chegou sem abrir planilha |
| Admin sem painel central | Sem visão consolidada de todas as áreas |
| Check-in manual inexistente (plano B) | Voluntário sem celular fica sem registro |
| Dependência do App Sheet (licença, limitações de UX) | Risco de continuidade e teto de crescimento |

### Fontes
- Especificação técnica compartilhada (documento de referência)
- Estrutura real das planilhas atuais (ver Apêndice A)
- [A DEFINIR] Entrevistas com líderes para validar pontos de dor e janelas de turno

---

## 3. Personas Afetadas + JTBD

### Persona 1 — Voluntário (Principal)
**Perfil:** Membro com serviço escalado, faixa etária ampla (18–60+). Acessa via smartphone próprio, geralmente com pressa ao chegar.
**JTBD:** *"Quando chego para servir, preciso confirmar minha presença rapidamente, para focar no serviço sem burocracia."*

### Persona 2 — Líder de Ministério (Secundária)
**Perfil:** Responsável por uma área (louvor, recepção, kids…). Coordena a equipe na ponta e monta a escala mensal.
**JTBD:** *"Quando coordeno o culto, preciso saber em tempo real quem chegou e quem falta, para acionar reservas ou redistribuir funções."*

### Persona 3 — Administrador da Igreja (Terciária)
**Perfil:** Gestor central. Visão global, governança de dados e resolução de exceções.
**JTBD:** *"Quando garanto a operação de um culto, preciso de controle total sobre todas as áreas e resolver exceções sem depender de terceiros."*

---

## 4. Solução Proposta

### O que fazemos

**MVP (Fases 1–4):**
- SPA leve acessada por **um QR Code genérico** — o mesmo para qualquer área e culto.
- Voluntário informa **apenas o telefone**. O backend cruza telefone + data/hora atual contra a planilha consolidada e **infere área, função, turno e culto**.
- **Máquina de estados** que decide automaticamente entre check-in, check-out ou mensagem de orientação (ver US-02 a US-06).
- **Check-out no mesmo QR:** se o voluntário já fez check-in, o mesmo fluxo oferece o check-out.
- Opção "Salvar dados neste aparelho" para fluxo one-tap em acessos recorrentes.
- Backend que lê/grava na planilha consolidada — **stack a definir entre Apps Script e Cloudflare Worker (ver Apêndice B; recomendação: Apps Script no MVP)**.

**Pós-MVP (Fases 5–6):**
- Painel `/lider`: dashboard em tempo real da área, gestão de escala, métricas de comparecimento.
- Painel `/admin`: visão global, CRUD de voluntários, override de escalas, check-in/out manual (plano B).
- Autenticação sem senha para as rotas restritas — via Google sign-in + allowlist (se Apps Script) ou Cloudflare Zero Trust (se Worker). Ver Apêndice B.

### Por que QR genérico funciona
O QR não precisa carregar a área porque **o telefone é a chave**. A planilha consolidada já contém `Telefone`, `Data`, `Turno`, `Área` e `Função` na mesma linha. Logo: telefone + data de hoje → linha da escala → tudo o que precisamos. Isso elimina a logística de imprimir e gerenciar QR Codes diferentes por área.

### Divisão de responsabilidades com o App Script
A consolidação das escalas na aba `Checkin Ser Amor` **continua sendo feita pelo Google App Script atual** — não migramos essa lógica. O App Script roda de forma **agendada** (eventualmente manual) e **sempre preserva** as colunas de presença (`In`, `Out`, `Checkin`, `Checkout`) ao reprocessar. Isso **elimina o risco de sobrescrita** que era a principal incógnita técnica da migração. O backend de check-in (Apps Script ou Worker — ver Apêndice B) **só lê** a aba para o lookup e **só grava** nas colunas de presença/`Observações`, localizando a linha pela chave única `Telefone + Data + Área + Turno`.

### O que NÃO fazemos nesta versão
- Não substituímos o Google Sheets como banco de dados (segue como fonte de verdade por ora).
- **Não migramos a consolidação das escalas** — segue no App Script existente.
- Não criamos app nativo (iOS/Android) — solução web-first.
- Não implementamos notificações push/lembretes de escala.
- Não criamos cadastro de novos voluntários pelo app (segue via líder/admin).
- Não integramos com financeiro, ERP ou streaming.
- **Não usamos as colunas de substituto** (`Voluntário Substituto`, `Data Troca`, `Motivo da Troca`) no MVP — a necessidade de quem chega fora da escala é coberta pela US-10 (presença fora da escala com motivo).
- Não fazemos check-out automático por horário (check-out é ação explícita do voluntário). [A CONFIRMAR — ver Dúvidas]

### Trade-offs conscientes
- **Google Sheets como banco + App Script para consolidação:** aceita limitações de concorrência/volume para manter custo zero, aproveitar dados existentes e não reescrever a lógica de consolidação. Para <100 voluntários por culto, a cota da Sheets API é folgada (ver Seção 6).
- **Inferência por data/hora:** simplifica drasticamente a operação (QR único), ao custo de exigir disambiguação quando o voluntário tem mais de uma escala no mesmo dia.
- **Autenticação por telefone (sem senha):** onboarding instantâneo, sem login persistente de conta — mitigado pelo localStorage do one-tap.

---

## 5. Requisitos Funcionais

### US-01 — Check-in via QR genérico com inferência (MUST)
> Como voluntário, quero escanear o QR Code e informar só meu telefone, para que o sistema descubra sozinho minha área e culto e eu confirme em segundos.

**Fluxo principal:**
1. Voluntário escaneia o QR genérico (ex.: `https://checkin.seramor.com.br`).
2. Tela exibe campo de telefone com máscara `(XX) XXXXX-XXXX`.
3. Voluntário digita e toca "Buscar".
4. Worker normaliza o telefone (só dígitos) e cruza com a planilha consolidada usando a **data/hora do servidor** para inferir a escala do dia.
5. Sistema resolve o estado e exibe a tela correspondente (US-02 a US-06).

**Regra de inferência:**
- `telefone` + `Data == hoje` → linha(s) da escala de hoje.
- O `Turno` da linha combinado com o horário atual ajuda a escolher quando houver mais de uma escala no dia (ver US-07).

**Máquina de estados (resolvida pelas flags `In`/`Out`):**
| `In` | `Out` | Estado | Tela |
|------|-------|--------|------|
| — (sem linha hoje) | — | Não escalado | US-03 (ou US-10) |
| `false` | `false` | Escalado, ainda não entrou | US-04 (Check-in) |
| `true` | `false` | Em serviço | US-05 (Check-out) |
| `true` | `true` | Concluído | US-05 (mensagem de serviço completo) |

---

### US-02 — Telefone não encontrado (MUST)
> Como voluntário não cadastrado, quero uma mensagem clara, para saber a quem recorrer.

**Critério:** DADO telefone ausente da base, QUANDO o Worker não encontra correspondência, ENTÃO exibe: *"Não encontramos este número na nossa base de voluntários. Por favor, procure o líder do seu ministério para atualizar seu cadastro."*

---

### US-03 — Cadastrado mas não escalado hoje (MUST)
> Como voluntário cadastrado fora da escala de hoje, quero ser identificado pelo nome e orientado.

**Critério:** DADO telefone encontrado na base (linha de outra data) mas sem escala para hoje, QUANDO o Worker resolve o estado, ENTÃO exibe: *"Olá, [Nome]! Não localizamos você na escala de hoje. Caso tenha sido escalado, por favor, procure o líder do ministério."* — com ação secundária opcional **[Vou servir hoje mesmo assim]** que leva à US-10 (se a US-10 estiver habilitada no MVP).

---

### US-04 — Caminho feliz: Confirmar check-in (MUST)
> Como voluntário escalado, quero ver minha área já inferida e confirmar com um toque.

**Critério:**
- DADO telefone escalado hoje e **sem check-in registrado**, QUANDO o Worker resolve o estado, ENTÃO exibe botão verde **[Confirmar Check-in]** com: *"Olá, [Nome]! Confirmar entrada no Ministério [Área] como [Função]?"*
- DADO o voluntário toca em Confirmar, QUANDO o Worker grava `In = true` e o carimbo de data/hora na coluna `Checkin`, ENTÃO exibe tela de sucesso com nome, área e horário.

---

### US-05 — Check-out no mesmo QR (MUST)
> Como voluntário que já fez check-in, quero registrar minha saída pelo mesmo QR, para fechar meu serviço do dia.

**Critério:**
- DADO telefone escalado hoje **com `In = true` e `Out = false`**, QUANDO o Worker resolve o estado, ENTÃO exibe botão **[Confirmar Check-out]** com: *"Olá, [Nome]! Você entrou às [hora]. Confirmar saída do Ministério [Área]?"*
- DADO o voluntário confirma, QUANDO o Worker grava `Out = true` e o carimbo na coluna `Checkout`, ENTÃO exibe tela de sucesso com duração do serviço (entrada → saída).
- DADO telefone **com `Out = true`**, QUANDO o Worker resolve o estado, ENTÃO exibe: *"Olá, [Nome]! Seu serviço de hoje já está completo. Obrigado por servir!"* (entrada e saída exibidas, sem botão de ação).

---

### US-06 — Fluxo One-Tap (SHOULD)
> Como voluntário recorrente, quero que meu telefone fique salvo no aparelho, para não redigitar a cada culto.

**Critério:**
- DADO um check-in/out concluído com "Salvar dados" marcado, QUANDO concluo a ação, ENTÃO o telefone é salvo em localStorage cifrado.
- DADO acesso futuro com dados salvos, QUANDO escaneio o QR, ENTÃO o app pula o input e já resolve o estado do dia (check-in **ou** check-out, conforme o caso).
- DADO desejo trocar de número, QUANDO toco em "Sair / Usar outro número", ENTÃO o localStorage é limpo.

---

### US-07 — Disambiguação de escala múltipla no mesmo dia (SHOULD)
> Como voluntário escalado em mais de uma área/turno no mesmo dia, quero escolher qual estou atendendo agora.

**Critério:**
- DADO telefone com 2+ escalas hoje, QUANDO o horário atual não resolve sozinho pelo turno, ENTÃO exibe: *"Você está escalado em mais de uma área hoje. Selecione:"* com a lista (Área · Turno · Função).
- DADO o voluntário seleciona uma, QUANDO confirma, ENTÃO check-in/out aplica-se apenas à linha escolhida.

---

### US-08 — Dashboard do Líder (SHOULD — Pós-MVP)
> Como líder, quero ver em tempo real quem fez check-in/out na minha área.

**Critério:**
- DADO acesso autenticado a `/lider`, QUANDO a página carrega, ENTÃO lista os escalados com status: ✅ Presente · 🟡 Em serviço (check-in sem check-out) · ⬜ Pendente · 🔵 Encerrado.
- DADO atualização, QUANDO há novo check-in/out, ENTÃO o status reflete em tempo real (polling leve — ver Seção 6).

---

### US-09 — Check-in/out Manual pelo Admin (MUST — Pós-MVP)
> Como admin, quero buscar pelo nome e registrar entrada/saída por um voluntário sem celular.

**Critério:**
- DADO acesso autenticado a `/admin`, QUANDO o admin busca pelo nome, ENTÃO exibe os escalados correspondentes (com área/turno).
- DADO seleção, QUANDO registra, ENTÃO grava com auditoria (responsável = e-mail do admin; flag de registro manual). [A DEFINIR — qual coluna registra o manual: usar "Observações" ou criar coluna dedicada]

---

### US-10 — Presença fora da escala com motivo (SHOULD — pode ser adiada)
> Como voluntário que chega para servir mas não está na escala de hoje (incluindo substitutos), quero registrar minha presença informando o motivo, para que minha entrada conste no sistema sem depender do admin.

**Decisão de escopo:** cobre tanto **substitutos** quanto **quem aparece sem escala**, sem usar as colunas dedicadas de troca. Marcada como **SHOULD** — se complicar o cronograma da Fase 3/4, pode ser adiada para pós-MVP e, nesse meio-tempo, o caso é resolvido pelo check-in manual do admin (US-09).

**Pré-condição de segurança:** disponível **apenas para telefone já cadastrado na base** (Cenário US-03). Telefone totalmente desconhecido (US-02) **não** pode criar registro — evita lixo/abuso na planilha.

**Critério:**
- DADO voluntário cadastrado mas sem escala hoje, QUANDO toca em **[Vou servir hoje mesmo assim]**, ENTÃO exibe seleção de `Área` e `Função` + campo **obrigatório** de motivo (ex.: "substituindo Fulano", "remanejado pelo líder").
- DADO o voluntário preenche e confirma, QUANDO o Worker insere uma nova linha na aba `Checkin Ser Amor` com `Data = hoje`, `In = true`, carimbo em `Checkin` e o motivo em `Observações`, ENTÃO a partir daí o fluxo de check-out (US-05) funciona normalmente.
- **Coordenação com App Script:** linhas inseridas pelo app fora da escala precisam sobreviver ao reprocessamento da consolidação (não podem ser apagadas). [A VALIDAR — ver Dúvidas]

---

## 6. Edge Cases e Requisitos Não-Funcionais

### Edge Cases

| Cenário | Comportamento Esperado |
|---------|----------------------|
| Voluntário substituto (telefone diferente do escalado) | Coberto pela US-10 (presença fora da escala com motivo), se habilitada; senão, check-in manual do admin (US-09) |
| Mesmo telefone tenta check-in 2x no mesmo culto | Flag `In = true` faz o sistema oferecer check-out (não duplica check-in) |
| 2+ escalas no mesmo dia | Disambiguação por turno/horário; se ainda ambíguo, tela de seleção (US-07) |
| Telefone cadastrado mas nunca escalado no mês carregado | Tratar como Cenário 2 (orientar a procurar líder); sem nome se não houver nenhuma linha — nesse caso, sem ação de US-10 |
| App Script reprocessa a consolidação durante o culto | Baixo risco: consolidação **sempre preserva** colunas de presença. Cuidado residual: não apagar linhas da US-10; preferir agendar fora da janela de culto |
| Timeout na chamada ao Worker (>5s) | Spinner + retry automático 1x; se persistir, erro com orientação |
| Input com DDI/formatos diversos (`+55`, espaços, traços) | Frontend e Worker normalizam para 11 dígitos antes de buscar |
| Conexão offline ao escanear | Mensagem offline + orientação para procurar líder |
| localStorage de culto anterior | Como o estado é sempre recalculado por data/hora no servidor, o telefone salvo é seguro de reusar; o estado do dia é sempre atual |
| Voluntário faz check-in mas nunca check-out | `In = true`, `Out = false` → fica "Em serviço"; admin pode encerrar; métrica de check-out tratada como opcional |
| Planilha indisponível (erro de API) | Worker retorna erro amigável (503) sem quebrar a tela |

### Requisitos Não-Funcionais

**Performance:**
- Resposta do Worker < 800ms em 95% das requisições.
- Carregamento inicial da SPA < 2s em 4G.
- Check-in completo (scan → confirmação) < 15s.

**Volume e cota da Google Sheets API (revisado):**
- Igreja opera com **< 100 voluntários por culto** e poucos cultos por semana.
- A Sheets API permite, por padrão, **300 requisições de leitura/min por projeto** e **60/min por usuário** — folga ampla mesmo num pico de chegada concentrado.
- Cada check-in/out = ~1 leitura (lookup) + 1 escrita. Mesmo 100 pessoas em 15 min ficam muito abaixo do limite.
- **Decisão:** **não usar KV Store nem cache de borda no MVP.** Leitura direta da planilha por requisição é suficiente. Reavaliar só se o volume crescer de forma relevante.

**Integridade de dados (coordenação backend ↔ App Script):**
- ✅ **Confirmado:** a consolidação do App Script **sempre preserva** `In`/`Out`/`Checkin`/`Checkout` ao reprocessar — não há risco de apagar check-ins.
- ✅ **Confirmado:** a chave `Telefone + Data + Área + Turno` é **única** na aba — o backend localiza a linha com segurança, sem necessidade de coluna de ID adicional.
- Único cuidado residual: garantir que a consolidação também **não apague linhas inseridas pela US-10** (presença fora da escala). [A VALIDAR — ver Dúvidas]
- Como o App Script roda agendado e o volume é baixo, a chance de uma execução de consolidação coincidir com um check-in é mínima; ainda assim, recomenda-se não agendar a consolidação dentro da janela de culto.

**Segurança:**
- API key/credencial do Google Sheets fica como *secret* no Worker — nunca no frontend.
- Rotas `/lider` e `/admin` protegidas por Cloudflare Zero Trust.
- Log de check-in/out com timestamp (Cloudflare Workers Logs).

**LGPD:**
- Telefone usado exclusivamente para identificação de voluntários.
- localStorage com opção explícita de remoção pelo usuário.
- [A DEFINIR] Política de retenção de logs.

**Disponibilidade:**
- Suportar eventos com até ~150 voluntários simultâneos (margem sobre os <100).
- Uptime alvo: 99,5% nos dias de culto.

**Acessibilidade:**
- Contraste WCAG AA; botões com área de toque ≥ 44×44px; teclado numérico no input de telefone.

---

## 7. Critérios de Aceite Consolidados

| US | Dado | Quando | Então |
|----|------|--------|-------|
| US-02 | Telefone inexistente | Worker não acha | Mensagem para procurar líder |
| US-03 | Telefone existe, sem escala hoje | Worker resolve estado | Mensagem com nome + orientação |
| US-04 | Escalado hoje, sem check-in | Worker resolve estado | Botão verde [Confirmar Check-in] com área/função inferidas |
| US-04 | Toca "Confirmar Check-in" | Grava coluna `Checkin` | Tela de sucesso com nome/área/horário |
| US-05 | Escalado hoje, com check-in e sem check-out | Worker resolve estado | Botão [Confirmar Check-out] |
| US-05 | Já com check-out | Worker resolve estado | Mensagem de serviço concluído (sem botão) |
| US-06 | One-tap ativo | Reabre via QR | Pula input e resolve estado do dia |
| US-07 | 2+ escalas hoje | Turno não resolve | Tela de seleção de área/turno |
| US-09 | Admin busca nome | Encontra escalado | Check-in/out manual com auditoria |

---

## 8. Métricas de Sucesso

| Métrica | Baseline | Target | Prazo | Como medir |
|---------|----------|--------|-------|------------|
| Taxa de check-in digital | [A DEFINIR — medir no piloto] | ≥ 85% | 30 dias após MVP | Check-ins vs. escala do dia |
| Tempo médio de check-in | [A DEFINIR — piloto] | < 15s | Ao lançar | Timestamps no backend |
| Taxa de check-out registrado | [A DEFINIR] | ≥ 60% dos check-ins | 30 dias | Coluna `Checkout` preenchida vs. `Checkin` |
| Adoção do one-tap | 0% (novo) | ≥ 60% dos recorrentes | 30 dias | localStorage hits vs. total |
| Erros/uso de check-in manual | [A DEFINIR] | < 5% do total | Por culto | Flag de registro manual |
| Satisfação dos líderes | [A DEFINIR — survey] | NPS ≥ 40 | 30 dias após Fase 5 | Formulário pós-culto |

---

## 9. Riscos e Mitigações

| Risco | Tipo | Prob. | Impacto | Mitigação |
|-------|------|-------|---------|-----------|
| Substituto/voluntário fora da escala não consegue check-in | Operacional | Alta | Médio | US-10 (presença fora da escala com motivo) ou check-in manual do admin (US-09) |
| Voluntário com 2 escalas no dia confunde a área | UX | Média | Médio | Disambiguação por turno + tela de seleção (US-07) |
| Voluntários com dificuldade de digitar telefone | UX | Média | Médio | Input otimizado (teclado numérico, máscara); one-tap; check-in manual |
| QR genérico danificado/coberto no local | Operacional | Média | Médio | Imprimir com qualidade + link curto de fallback visível abaixo do QR |
| Falha silenciosa de gravação na planilha | Técnico | Baixa | Alto | Confirmar escrita com retry; log de erro com alerta |
| App Script apaga linhas da US-10 ao reprocessar | Técnico | Baixa | Médio | Consolidação já preserva colunas de presença; validar que também não remove linhas inseridas fora da escala; agendar fora do culto |
| Latência/concorrência do backend no pico de chegada | Técnico | Média | Médio | Validar no piloto (Fase 4); se Apps Script não der conta do "rush", migrar a rota de leitura/escrita para Worker (contrato de dados idêntico — migração contida) |
| Vazamento de credencial (se usar Worker + service account) | Segurança | Baixa | Alto | Credencial como secret no Worker, nunca no frontend; N/A se backend for Apps Script |
| Config incorreta do controle de acesso expõe `/admin` | Segurança | Baixa | Alto | Teste end-to-end das políticas antes do go-live (allowlist Google ou Zero Trust) |

---

## 10. Timeline e Dependências

| Fase | Escopo | Critério de Conclusão |
|------|--------|----------------------|
| **Fase 1** ✅ | Dados e estrutura no Google Sheets (já existe) | Base validada (ver Apêndice A) |
| **Fase 2** Infraestrutura | **Decidir backend (Apêndice B)** + setup do hosting + lógica de inferência por telefone/data | Backend resolve os estados (não cadastrado / não escalado / check-in / check-out / concluído) |
| **Fase 3** Core Experience | Frontend SPA: QR genérico, input com máscara, máquina de estados, one-tap, disambiguação | Checklist de UX validado com ≥1 líder |
| **Fase 4** Homologação MVP | Piloto em 1 área em culto real + **medição de latência/concorrência no rush** | ≥10 check-ins/out reais sem erro crítico; tempo de resposta aceitável no pico |
| **Fase 5** Gestão de Liderança | Painel `/lider` + autenticação das rotas restritas | Líder piloto valida visibilidade em tempo real |
| **Fase 6** Governança Central | Painel `/admin` + check-in/out manual | Admin valida resolução de exceções |

### Dependências Críticas
- **Decisão de backend (Apêndice B):** definir Apps Script vs Worker antes da Fase 2 — afeta setup, auth e hosting.
- **Acesso aos dados:** se Apps Script → nada a fazer (acesso nativo); se Worker → Google Cloud Project + Service Account compartilhando as planilhas, antes da Fase 2.
- **Compatibilização do App Script:** validar que a consolidação não apaga linhas da US-10 e, idealmente, não roda na janela de culto — antes da Fase 2.
- **Subdomínio:** definir host (ex.: `checkin.seramor.com.br`) antes da Fase 3.
- **E-mails de líderes/admins:** levantar antes da Fase 5 (allowlist Google ou Zero Trust).
- **QR Code físico:** produzir e afixar antes da Fase 4.

### Marcos
- 🏁 **M1:** Backend resolve todos os estados por telefone+data.
- 🏁 **M2:** Primeiro check-in/out real via QR em culto.
- 🏁 **M3:** ≥3 líderes usando `/lider` autonomamente.
- 🏁 **M4:** App Sheet desativado; sistema novo em 100% das áreas.

---

## Apêndice A — Estrutura Real das Planilhas

### A.1 — Planilha por Área (uma por ministério)

**Aba `Voluntários`**
`Nome completo` · `Telefone` · `Função` · `Observações` · `Ativo?` · `Início`

**Abas mensais `Escala <Mês>`** (ex.: `Escala Maio`)
`Data` · `Voluntário` · `Período` · `Função` · `Telefone` · `Observações`

### A.2 — Planilha de Check-in (consolidada)

**Aba `Checkin Ser Amor`** — compila todas as escalas para registro
`In` · `Out` · `Voluntário` · `Função` · `Turno` · `Data` · `Checkin` · `Checkout` · `Observações` · `Telefone` · `Voluntário Substituto` · `Data Troca` · `Motivo da Troca` · `Área`

### A.3 — Como o app usa cada planilha
- **Lookup principal:** aba `Checkin Ser Amor` (já tem `Telefone`, `Data`, `Turno`, `Área`, `Função` numa linha só → permite QR genérico).
- **Semântica das colunas de presença:**
  - `In` / `Out` → **flags booleanas** (true/false). Estado: `In=false` (pendente) → `In=true,Out=false` (em serviço) → `Out=true` (concluído).
  - `Checkin` / `Checkout` → **carimbos reais** com data e hora exatos.
- **Gravar check-in:** `In = true` + carimbo em `Checkin`.
- **Gravar check-out:** `Out = true` + carimbo em `Checkout`.
- **Presença fora da escala (US-10):** inserir nova linha com `Data`, `Área`, `Função`, `In=true`, carimbo em `Checkin` e motivo em `Observações`.
- **Consolidação:** feita pelo **App Script existente** (não migra), de forma **agendada**, e **sempre preserva** as colunas de presença. O backend de check-in apenas lê a aba e escreve nas colunas de presença.
- **Substituição:** colunas `Voluntário Substituto` / `Data Troca` / `Motivo da Troca` — **fora do escopo do MVP** (não usadas pelo app).

> ✅ **Coordenação backend ↔ App Script (resolvida):** a consolidação roda agendada e **sempre preserva** `In`/`Out`/`Checkin`/`Checkout`; a chave `Telefone + Data + Área + Turno` é **única**. Cuidado residual: garantir que a consolidação não apague linhas da US-10 e, idealmente, não rode na janela de culto.

---

## Dúvidas — Resolvidas e em Aberto

### ✅ Resolvidas nesta versão
1. **`In`/`Out` vs `Checkin`/`Checkout`** → `In`/`Out` são flags booleanas; `Checkin`/`Checkout` são carimbos reais de data/hora. O app grava ambos.
2. **Substitutos / fora da escala** → coberto pela US-10 (inserir linha com motivo obrigatório em `Observações`), restrita a telefones já cadastrados. Pode ser adiada para pós-MVP, com o admin (US-09) cobrindo o caso no intervalo. Colunas dedicadas de troca ficam fora do MVP.
3. **Alimentação da consolidada** → feita por App Script **agendado**, que **permanece** e **sempre preserva** as colunas de presença.
4. **Risco de sobrescrita** → eliminado: consolidação sempre preserva `In`/`Out`/`Checkin`/`Checkout`.
5. **Chave da linha** → `Telefone + Data + Área + Turno` é **única**; backend mira a linha com segurança, sem coluna de ID extra.

### ❓ Em aberto (não bloqueiam a Fase 2, mas precisam ser definidas)
6. **Decisão de backend:** confirmar Apps Script vs Worker (ver Apêndice B — **recomendação: Apps Script no MVP**).
7. **Janelas de turno:** quais os horários de cada `Turno`/`Período`? Sem isso, a inferência por horário não roda e a US-07 sempre cai na tela de seleção (degradação aceitável, mas pior UX).
8. **Frequência de escala múltipla no mesmo dia:** é comum alguém servir em 2 áreas/turnos no mesmo dia? Se for raro, a tela de seleção basta.
9. **Política de check-out:** obrigatório, desejável ou opcional? Há expectativa de check-out automático por fim de turno?
10. **US-10 no MVP ou pós-MVP?** Entra já no piloto ou o admin (US-09) cobre o caso no início?

---

## Apêndice B — Decisão de Arquitetura de Backend

**Pergunta:** com a consolidação permanecendo no App Script, o risco de sobrescrita eliminado e o volume baixo (<100/culto), ainda faz sentido um Cloudflare Worker, ou o próprio Apps Script deve ser o backend de check-in?

### Comparação

| Critério | Apps Script (Web App) | Cloudflare Worker + Sheets API |
|----------|----------------------|-------------------------------|
| Acesso aos dados | Nativo (`SpreadsheetApp`), sem credencial | Exige Service Account + assinatura OAuth/JWT no Worker |
| Setup inicial | Mínimo (já existe projeto App Script) | Google Cloud Project, service account, secret no Worker |
| Stack/competência | Time já domina (escreveu a consolidação) | Exige familiaridade com Workers/JS |
| Custo | $0 | $0 (free tier) |
| Performance por requisição | ~1–3s (cold start + abertura da planilha) | <800ms (edge) |
| Concorrência | Limite de ~30 execuções simultâneas | Praticamente ilimitada p/ este porte |
| CORS (se frontend separado) | Atrito conhecido | Controle total dos headers |
| Hosting do frontend | HTML Service (mesma origem, sem CORS) ou Pages | Cloudflare Pages |
| Auth `/lider` `/admin` | Google sign-in + allowlist de e-mail | Cloudflare Zero Trust |
| Nº de stacks a manter | 1 (tudo no Google) | 2 (Google + Cloudflare) |

### Recomendação: **Apps Script no MVP**
Os motivos que originalmente justificavam o Worker (cache de borda, alta concorrência, performance de edge) **perderam força**: o KV foi descartado, o volume é baixo e a consolidação + acesso nativo aos dados já vivem no Google. Manter tudo em Apps Script significa **um só ecossistema, zero credenciais para gerenciar, a linguagem que o time já conhece e nenhum atrito de CORS** (servindo o frontend via HTML Service na mesma origem). A autenticação das rotas restritas sai de graça com login Google + allowlist, dado que a igreja já usa Google.

**O único risco real é latência/concorrência no "rush" de chegada.** Para <100 voluntários, com pico realista de poucas requisições simultâneas (cada uma curta) e gravações em linhas distintas (chave única, sem contenção), o Apps Script tende a dar conta — com um bom estado de carregamento na UI cobrindo o ~1–2s por requisição.

### Critério de migração (gatilho objetivo)
Se o **piloto (Fase 4)** mostrar tempo de resposta inaceitável ou erros de concorrência no pico, migrar **apenas a rota de leitura/escrita** para um Worker. Como o **contrato de dados é idêntico** (mesma chave, mesmas colunas), a migração é contida e reversível — não reescreve frontend nem a consolidação.

### Recomendação de hosting do frontend
- **Com Apps Script:** servir a SPA via HTML Service (mesma origem, elimina CORS) — opção mais simples; ou Pages se quiser URL/CDN melhores (aí trata-se o CORS).
- **Com Worker:** Cloudflare Pages naturalmente.

---

*PRD v1.3 — risco de sobrescrita eliminado e decisão de arquitetura de backend documentada (Apêndice B). Recomendação: Apps Script no MVP, com migração reversível para Worker caso o piloto exija. Dúvidas 6–10 a confirmar com stakeholders; nenhuma bloqueia o início da Fase 2.*
