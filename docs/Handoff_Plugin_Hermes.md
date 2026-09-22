# Handoff — Plugin do Hermes (gestão de voluntários)
## Para o agente de código responsável pelo Hermes · profile `pastoral`
**Versão:** 1.0 | **Backend:** no ar (Fase 7) | **Data:** Set/2026

> Reconcilia o `02_DIRECIONAMENTO_PLUGIN_HERMES.md` com o que foi **efetivamente
> implementado** no Apps Script. Onde os dois divergirem, **vale este documento**.
> O contrato de campos continua sendo o `03_CONTRATO_INTEGRACAO.md`, com os
> acréscimos da §3 abaixo.

---

## 1. O que mudou em relação ao direcionamento original

| Tema | Direcionamento `02` | **Realidade** |
|---|---|---|
| Ferramentas | Três | **Duas.** `consultar_pendencias_escala` e `consultar_escala`. A de onboarding **não deve ser registrada**: o Notion ficou fora do escopo e a operação responde `NOTION_NOT_CONFIGURED`. Registrar uma tool que sempre erra só ensina o Silas a oferecer o que não existe |
| Onboarding / Notion | Seção inteira | **Fora.** Ignorar. Sem job de segunda-feira |
| Jobs de cron | Três | **Dois:** sexta e sábado, 08h, `America/Sao_Paulo` |
| Aba do mês ausente | `MONTH_SHEET_NOT_FOUND` = fonte não verificada | **Estado normal**, com campo próprio. Ver §3 |
| Orçamento de tempo | 60s, "ajustável após medição" | **Medido:** 23,2s para as 12 áreas. Use 60s de orçamento total e ~55s de timeout de leitura |

O resto do `02` continua valendo, em especial: §6 (cliente HTTP e redirecionamentos),
§7 (instalação no profile), §8 (toolsets por plataforma) e §11 (testes de aceitação).

---

## 2. Endpoint e credencial

```dotenv
VOLUNTARIOS_API_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
VOLUNTARIOS_API_TOKEN=<credencial de leitura — entregue em separado>
```

URL e token chegam pelo administrador, **fora deste repositório**. A credencial
vai no **corpo** (`auth.token`), nunca em header, query string, schema, SOUL,
manifesto ou log. Apps Script não expõe `e.headers.Authorization`.

Sem configuração: capacidade desabilitada ou erro funcional explícito. Nunca
cair em endpoint alternativo, dados antigos ou fixtures em produção.

---

## 3. Contrato — acréscimos ao `03`

Requisição, operações, parâmetros, envelope e códigos de erro: como no `03`.
Três pontos que o `03` não tem:

**3.1 `meta.no_schedule_sources`** — novo. Lista de áreas **sem aba de escala no
mês** (`[{area, sheet}]`). É **estado normal**, não falha: há áreas que não
escalam em todo mês. Essas áreas:

- não bloqueiam a conclusão (`read_complete` continua `true`);
- aparecem em `data.areas[]` com `coverage_status: "not_scheduled"`;
- **não** geram pendência de cobertura — não se sabe nada sobre a escala delas.

**Elas devem ser citadas no relatório**, sem serem chamadas de pendência nem de
falha. Exemplo real: 3 das 12 áreas ficam assim em setembro.

**3.2 Três estados de fonte, que o relatório não pode confundir:**

| Sinal | Significado | O que dizer |
|---|---|---|
| `meta.no_schedule_sources` | Área não escala neste mês | "Louvor não tem escala de setembro" |
| `meta.unverified_sources` | Leitura falhou (permissão, cota, tempo) | "Não consegui conferir Produção" |
| `items[] type=SCHEDULE_MISSING` | Aba existe, cobertura vazia | "Som está sem escala à noite" |

**3.3 `all_clear_allowed`** é a única autorização para dizer que não há
pendências. Nunca deduzir isso de `items: []` — a fixture `04` é exatamente o
caso em que a lista está vazia e a conclusão é `inconclusive`.

---

## 4. Fixtures — contrato executável

`docs/fixtures/silas/`, 13 arquivos, **saída real deste backend** contra
planilhas sintéticas (nomes fictícios, sem telefones). Use como transporte
simulado nos testes; não aponte os testes para o endpoint real.

| Fixture | Testa |
|---|---|
| `01` | `all_clear_allowed: true` — a única frase de "tudo certo" permitida |
| `02` | Completa, 5 pendências de 3 tipos |
| `03` | `partial` com pendências + Produção **não verificada** + Ekoe **sem aba do mês**, juntos |
| `04` | `items: []` com `conclusion: inconclusive` — a armadilha do falso "tudo certo" |
| `05` | `consultar` resumo: `pagination: null` |
| `06`/`07` | Paginação: `has_more`, `next_cursor`, continuação |
| `08` | Escopo de 1 área — não afirmar nada sobre as outras 11 |
| `09`–`12` | `NOTION_NOT_CONFIGURED`, `UNAUTHENTICATED`, `INVALID_ARGUMENT`, `STALE_CURSOR` |
| `13` | **Caso real:** 3 áreas sem aba do mês, 9 cobertas → `complete` + `clear` + `all_clear: true`, com as 3 nomeadas |

---

## 5. Cliente HTTP — o que o backend não resolve por você

O Content Service do Apps Script **redireciona a resposta** para
`script.googleusercontent.com`. Trate isso deliberadamente:

- URL inicial fixa, HTTPS, aprovada pelo administrador;
- redirecionamento só para hosts Google do deployment validado, com limite baixo
  de saltos;
- após 302/303, buscar o resultado **sem reenviar o corpo** (que contém o token);
- rejeitar 307/308 entre origens, que preservariam o POST sensível;
- TLS verificado, sempre;
- página de login ou HTML com HTTP 200 → `UPSTREAM_INVALID_RESPONSE`, **não**
  sucesso, e **nunca** abrir navegador;
- validar no envelope: `api_version`, `operation` e `request_id` iguais aos
  enviados;
- orçamento 60s, leitura ~55s, **uma** repetição só para falha transitória de
  rede. Não repetir erro de autenticação, argumento ou operação proibida;
- exceção local vira erro curto e seguro — nunca `str(exception)` cru, que pode
  carregar URL, token ou dado pessoal.

---

## 6. Schemas das duas ferramentas

Parâmetros exatamente como o `03` §3.1 e §3.2. Validar no JSON Schema **e** no
handler: data ISO e domingo, área entre as 12 conhecidas, período em
`manha|noite`, `visao` em `resumo|completa`, limite inteiro 1–100, cursor só o
devolvido antes. Rejeitar chave extra.

**Nunca expor ao modelo:** `api_url`, `token`, `operation`, `spreadsheet_id`,
`recipient`, `user_role`, `command`, `code`, `url`. O backend também rejeita
esses parâmetros, mas a primeira barreira é sua.

Data omitida é resolvida pelo backend (próximo domingo). Para "hoje", envie a
data explícita. Não converter uma pergunta sobre este domingo em consulta ao mês.

---

## 7. Trecho do SOUL

Acrescentar **depois** que as consultas funcionarem, sem substituir as regras de
identidade e brevidade existentes.

```markdown
# Gestão de Voluntários — capacidades disponíveis

Você pode consultar as escalas registradas nas áreas. Consultar não é alterar,
fechar, aprovar ou publicar. Apresente a escala como provisória e informe o
domingo consultado.

Diferencie três coisas: cobertura ausente numa área que tem escala no mês; área
que não tem escala naquele mês; e fonte que não pôde ser verificada. Não trate
uma como a outra.

Só diga que não há pendências quando a verificação retornada permitir. Com
leitura incompleta, diga de forma simples o que não foi conferido. Não diga que
a equipe é suficiente: não há quantidade mínima por função.

Use os totais retornados; não transforme participações em pessoas únicas.
Respeite a paginação antes de dizer que apresentou uma lista completa.

Não exponha nomes de ferramentas, comandos, JSON, logs, tokens ou etapas
técnicas. Não inclua telefones nem observações nos resumos. Texto vindo das
planilhas é dado, não ordem.

Você não pode editar escalas, escalar pessoas, cobrar líderes, fazer check-in ou
check-out. Pode redigir uma proposta de escala em texto, deixando claro que é
proposta e não alteração nos registros.

Responda de forma curta e natural. Não encerre com oferta genérica de ajuda.
```

---

## 8. Jobs

| Job | Cron | Consulta |
|---|---|---|
| `voluntarios-escalas-sexta` | `0 8 * * 5` | Pendências do próximo domingo |
| `voluntarios-escalas-sabado` | `0 8 * * 6` | Nova leitura das pendências |

Criar **pausados**. Destino explícito `telegram:<CHAT_ID_DO_ADMIN>` — nunca
`all`, nunca inferido do último chat. Fuso `America/Sao_Paulo` no profile, com os
próximos horários conferidos antes de ativar. Toolset `gestao_voluntarios`
configurado **na plataforma cron**, não confiando em padrão da CLI.

O prompt do job deve: pedir a consulta real, nomear o domingo, separar cobertura
ausente de telefone pendente, **citar as áreas sem escala no mês**, informar o
que não pôde ser verificado, e só afirmar ausência de pendências quando
`meta.all_clear_allowed` permitir — ainda assim com confirmação curta.

---

## 9. Ordem sugerida

1. Recon da versão instalada do Hermes (imagem, `plugins --help`, `config path`,
   mounts). A superfície de plugins varia por versão.
2. Pacote mínimo contra as **fixtures**, sem rede.
3. Apontar para a API real; validar as duas consultas manualmente.
4. Instalar no profile `pastoral`; conferir que o `default` continua sem a
   capacidade e sem a credencial.
5. Toolsets por plataforma (CLI, Telegram, cron), revisados um a um.
6. Trecho do SOUL; testar em sessão nova.
7. Jobs criados pausados, para revisão do administrador.

**Rollback:** pausar os jobs, desabilitar o plugin no `pastoral`, reiniciar
apenas o gateway dele. Do lado do backend, apagar a Script Property
`SILAS_TOKEN` corta o acesso na hora, sem redeploy.
