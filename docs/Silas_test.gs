/**
 * Testes da integração Silas (Fase 7). Rodar no editor do Apps Script:
 * selecionar `test_silas_todos` → Executar → conferir o log de Execuções.
 *
 * NÃO HÁ AMBIENTE DE HOMOLOGAÇÃO: as 12 planilhas são as de produção. Por isso
 * toda a regressão de normalização e de regras roda sobre MATRIZES SINTÉTICAS
 * passadas para silasNormalizar_ (função pura) — nenhum teste abre, lê ou
 * escreve planilha real. O único teste que toca produção é o
 * `test_silas_smoke_producao`, explicitamente somente-leitura e opcional.
 *
 * Cobre os cenários obrigatórios do direcionamento (doc 1, §10), exceto os de
 * Notion (fora do escopo desta entrega).
 */

var _silasFalhas = [];

function _sOk(cond, nome) {
  if (!cond) _silasFalhas.push(nome);
  Logger.log((cond ? 'PASS  ' : 'FALHA ') + nome);
}

function _sEq(got, esperado, nome) {
  var a = JSON.stringify(got), b = JSON.stringify(esperado);
  _sOk(a === b, nome + (a === b ? '' : ' — obtive ' + a + ', esperava ' + b));
}

/** Monta a matriz de uma aba `Escala <Mês>` a partir de linhas simples. */
function _sAba(linhas) {
  var head = ['Data', 'Voluntário', 'Período', 'Função', 'Telefone', 'Observações'];
  var valores = [head], exibidos = [head];
  for (var i = 0; i < linhas.length; i++) {
    var l = linhas[i]; // [data, nome, periodo, funcao, telefoneValor, telefoneExibido]
    valores.push([l[0], l[1], l[2], l[3] || '', l[4] === undefined ? '' : l[4], 'obs livre']);
    exibidos.push([String(l[0]), l[1], l[2], l[3] || '', l[5] === undefined ? String(l[4] === undefined ? '' : l[4]) : l[5], 'obs livre']);
  }
  return { valores: valores, exibidos: exibidos };
}

function _sNorm(areaId, alvo, linhas) {
  var m = _sAba(linhas);
  return silasNormalizar_(silasArea_(areaId), alvo, silasNomeAba_(alvo), m.valores, m.exibidos);
}

function _sCobertura(areaId, res) {
  var porPeriodo = { manha: 0, noite: 0 };
  for (var i = 0; i < res.assignments.length; i++) porPeriodo[res.assignments[i].period]++;
  return silasAvaliarCobertura_(silasRegra_(areaId), porPeriodo);
}

// ============================ DATAS ============================

function test_silas_datas() {
  _sEq(silasProximoDomingo_('2026-09-22'), '2026-09-27', 'terça → próximo domingo');
  _sEq(silasProximoDomingo_('2026-09-27'), '2026-10-04', 'domingo → domingo seguinte (estritamente posterior)');
  _sEq(silasProximoDomingo_('2026-12-29'), '2027-01-03', 'virada de ano');
  _sOk(silasIsoEhDomingo_('2026-09-27'), 'reconhece domingo');
  _sOk(!silasIsoEhDomingo_('2026-09-26'), 'sábado não é domingo');
  _sEq(silasNomeAba_('2027-01-03'), 'Escala Janeiro', 'aba pelo mês da data-alvo');
  _sEq(silasNomeAba_('2026-09-27'), 'Escala Setembro', 'aba de setembro');
  _sOk(!silasIsoValido_('2026-02-30'), 'rejeita data inexistente');
  _sOk(!silasIsoValido_('27/09/2026'), 'rejeita formato não-ISO');
}

// ====================== NORMALIZAÇÃO DE LINHAS ======================

function test_silas_normalizacao() {
  var alvo = '2026-09-27';

  // Manhã, Noite na mesma célula → 2 participações, 1 origem.
  var r1 = _sNorm('som', alvo, [['27/09/2026', 'Ana Exemplo', 'Manhã, Noite', 'Mesa', '11999990000']]);
  _sEq(r1.assignments.length, 2, 'Manhã, Noite gera 2 participações');
  _sEq(r1.assignments[0].source_ref.row, 2, 'participação 1 aponta a linha de origem');
  _sEq(r1.assignments[1].source_ref.row, 2, 'participação 2 aponta a MESMA origem');
  _sEq(r1.phoneIssues.length, 0, 'telefone preenchido não gera pendência');

  // Mesma pessoa em 2 linhas/períodos: preservar ambas, sem mesclar identidade.
  var r2 = _sNorm('som', alvo, [
    ['27/09/2026', 'Ana Exemplo', 'Manhã', 'Mesa', '11999990000'],
    ['27/09/2026', 'Ana Exemplo', 'Noite', 'Mesa', '11999990000']
  ]);
  _sEq(r2.assignments.length, 2, 'duas linhas da mesma pessoa preservadas');
  _sOk(r2.assignments[0].source_ref.row !== r2.assignments[1].source_ref.row, 'origens distintas');

  // Telefone: ausente, fórmula vazia e erro de fórmula.
  var r3 = _sNorm('som', alvo, [
    ['27/09/2026', 'Sem Telefone', 'Manhã', '', '', ''],
    ['27/09/2026', 'Formula Vazia', 'Manhã', '', '=PROCV(...)', ''],
    ['27/09/2026', 'Formula Erro', 'Manhã', '', '#N/A', '#N/A'],
    ['27/09/2026', 'Manual Ok', 'Manhã', '', '11988887777', '11988887777']
  ]);
  _sEq(r3.phoneIssues.length, 3, 'três linhas com problema de telefone');
  _sEq(r3.phoneIssues[0].type, 'PHONE_MISSING', 'telefone ausente');
  _sEq(r3.phoneIssues[1].type, 'PHONE_MISSING', 'fórmula que devolve vazio continua pendente');
  _sEq(r3.phoneIssues[2].type, 'PHONE_ERROR', 'erro de fórmula ≠ ausente');
  _sEq(r3.assignments.length, 4, 'telefone pendente não apaga a pessoa da escala');

  // Linha com 2 períodos e telefone vazio conta UMA vez como linha com problema.
  var r4 = _sNorm('som', alvo, [['27/09/2026', 'Dois Periodos', 'Manhã, Noite', '', '', '']]);
  _sEq(r4.phoneIssues.length, 1, 'uma linha com problema, mesmo afetando 2 períodos');
  _sEq(r4.assignments.length, 2, 'ainda são 2 participações');

  // Data de outro ano na mesma aba do mês não entra na consulta.
  var r5 = _sNorm('som', alvo, [
    ['27/09/2026', 'Deste Ano', 'Manhã', '', '11999990000'],
    ['27/09/2025', 'Ano Passado', 'Manhã', '', '11999990000']
  ]);
  _sEq(r5.assignments.length, 1, 'aba sem ano no nome: filtra pela data completa');
  _sEq(r5.assignments[0].volunteer_name, 'Deste Ano', 'ficou a linha do ano certo');

  // Qualidade de dados: nome presente sem data/período interpretável.
  var r6 = _sNorm('som', alvo, [
    ['', 'Sem Data', 'Manhã', '', '11999990000'],
    ['banana', 'Data Ilegivel', 'Manhã', '', '11999990000'],
    ['27/09/2026', 'Periodo Ilegivel', 'Tarde', '', '11999990000'],
    ['27/09/2026', '', 'Manhã', '', '']
  ]);
  _sEq(r6.invalidRows.length, 3, 'linhas com pessoa e dado ilegível viram ROW_INVALID');
  _sEq(r6.assignments.length, 0, 'nenhuma participação classificada por adivinhação');
  _sEq(r6.invalidRows[2].reason, 'PERIOD_UNPARSEABLE', 'período desconhecido não vira manhã/noite');

  // Célula de data como Date (caso real da planilha).
  var m = _sAba([['x', 'Com Date', 'Noite', '', '11999990000']]);
  m.valores[1][0] = new Date(2026, 8, 27); // 27/09/2026 local
  var r7 = silasNormalizar_(silasArea_('som'), alvo, silasNomeAba_(alvo), m.valores, m.exibidos);
  _sEq(r7.assignments.length, 1, 'célula Date normalizada para a data-alvo');

  // Observações nunca sai no payload.
  _sOk(JSON.stringify(r1).indexOf('obs livre') < 0, 'Observações não vaza para a resposta');
  // Telefone nunca sai no payload (só o status).
  _sOk(JSON.stringify(r3).indexOf('11988887777') < 0, 'valor do telefone não vaza para a resposta');
}

// ======================= REGRAS DE COBERTURA =======================

function test_silas_cobertura() {
  var alvo = '2026-09-27';
  var tel = '11999990000';

  var t1 = _sCobertura('transmissao', _sNorm('transmissao', alvo, [['27/09/2026', 'A', 'Noite', '', tel]]));
  _sEq(t1.status, 'ok', 'Transmissão só à noite: sem pendência');

  var t2 = _sCobertura('transmissao', _sNorm('transmissao', alvo, [['27/09/2026', 'A', 'Manhã', '', tel]]));
  _sEq(t2.faltas, [['noite']], 'Transmissão só de manhã: pendência noturna (manhã nunca é exigida)');

  var f1 = _sCobertura('foto_video', _sNorm('foto_video', alvo, [['27/09/2026', 'A', 'Manhã', '', tel]]));
  _sEq(f1.status, 'ok', 'Foto e Vídeo só de manhã: sem pendência');

  var f2 = _sCobertura('foto_video', _sNorm('foto_video', alvo, [['27/09/2026', 'A', 'Noite', '', tel]]));
  _sEq(f2.status, 'ok', 'Foto e Vídeo só à noite: sem pendência');

  var f3 = _sCobertura('foto_video', _sNorm('foto_video', alvo, []));
  _sEq(f3.faltas.length, 1, 'Foto e Vídeo vazio: UMA pendência, não duas');
  _sEq(f3.faltas[0], ['manha', 'noite'], 'a falta é do grupo "pelo menos um período"');

  var s1 = _sCobertura('som', _sNorm('som', alvo, [['27/09/2026', 'A', 'Manhã', '', tel]]));
  _sEq(s1.faltas, [['noite']], 'Som só de manhã: pendência noturna');

  var s2 = _sCobertura('som', _sNorm('som', alvo, []));
  _sEq(s2.faltas.length, 2, 'Som vazio: duas faltas (exige ambos)');

  var s3 = _sCobertura('som', _sNorm('som', alvo, [['27/09/2026', 'A', 'Manhã, Noite', '', tel]]));
  _sEq(s3.status, 'ok', 'uma pessoa nos dois períodos cobre a área');

  // Regra vale por área, não por filtro de apresentação: cobertura é avaliada
  // com todos os períodos exigidos ANTES de qualquer filtro (doc 1, §4).
  var f4 = _sCobertura('foto_video', _sNorm('foto_video', alvo, [['27/09/2026', 'A', 'Noite', '', tel]]));
  _sEq(f4.status, 'ok', 'consulta da manhã em Foto e Vídeo noturno não cria pendência falsa');
}

// ===================== ROTEADOR, AUTH E CONTRATO =====================

function test_silas_roteador() {
  // Corpo híbrido: tentativa de alcançar o roteador legado de escrita.
  var r1 = silasRoute_({ api_version: '1', operation: 'voluntarios.escalas.pendencias', action: 'adminCheckin' }, 200);
  _sEq(r1.error.code, 'INVALID_ARGUMENT', 'corpo com action+operation é rejeitado');
  _sEq(r1.ok, false, 'rejeição mantém ok=false');

  // Versão incompatível é barrada antes da credencial.
  var r2 = silasRoute_({ api_version: '9', operation: 'voluntarios.escalas.pendencias' }, 200);
  _sEq(r2.error.code, 'UNSUPPORTED_VERSION', 'versão não suportada');

  // Corpo acima do limite da aplicação.
  var r3 = silasRoute_({ api_version: '1', operation: 'voluntarios.escalas.pendencias' }, 999999);
  _sEq(r3.error.code, 'INVALID_ARGUMENT', 'corpo grande demais é recusado');

  // Sem credencial válida não há leitura (falha fechada).
  var r4 = silasRoute_({ api_version: '1', operation: 'voluntarios.escalas.pendencias', auth: { token: 'errado' } }, 200);
  _sEq(r4.error.code, 'UNAUTHENTICATED', 'token inválido não lê nada');

  // Operação fora da allowlist.
  var r5 = silasRoute_({ api_version: '1', operation: 'voluntarios.escalas.gravar', auth: { token: 'errado' } }, 200);
  _sOk(r5.error.code === 'UNAUTHENTICATED' || r5.error.code === 'FORBIDDEN_OPERATION', 'operação desconhecida nunca executa');

  // Envelope de erro não vaza detalhe interno.
  _sOk(r4.error.message.indexOf('SILAS_TOKEN') < 0, 'mensagem de erro não cita a property');
  _sEq(r4.meta.all_clear_allowed, false, 'erro nunca autoriza "tudo certo"');

  // Request ID malformado não é ecoado.
  var r6 = silasRoute_({ api_version: '1', operation: 'x', request_id: '<script>alert(1)</script>' }, 200);
  _sEq(r6.request_id, null, 'request_id inválido não é ecoado');
}

function test_silas_parametros() {
  var op = 'voluntarios.escalas.consultar';
  _sEq(silasValidarEscala_({ data: '2026-09-26' }, op).error.code, 'INVALID_ARGUMENT', 'data que não é domingo é recusada');
  _sEq(silasValidarEscala_({ area: 'financeiro' }, op).error.code, 'INVALID_ARGUMENT', 'área desconhecida é recusada');
  _sEq(silasValidarEscala_({ periodo: 'tarde' }, op).error.code, 'INVALID_ARGUMENT', 'período inválido é recusado');
  _sEq(silasValidarEscala_({ limite: 500 }, op).error.code, 'INVALID_ARGUMENT', 'limite acima do máximo é recusado');
  _sEq(silasValidarEscala_({ visao: 'tudo' }, op).error.code, 'INVALID_ARGUMENT', 'visão inválida é recusada');

  // Parâmetros administrativos nunca são aceitos do modelo.
  _sEq(silasValidarEscala_({ spreadsheet_id: 'abc' }, op).error.code, 'INVALID_ARGUMENT', 'spreadsheet_id é recusado');
  _sEq(silasValidarEscala_({ token: 'abc' }, op).error.code, 'INVALID_ARGUMENT', 'token em params é recusado');
  _sEq(silasValidarEscala_({ role: 'admin' }, op).error.code, 'INVALID_ARGUMENT', 'role é recusado');
  _sEq(silasValidarEscala_({ url: 'http://x' }, op).error.code, 'INVALID_ARGUMENT', 'url é recusada');

  var v = silasValidarEscala_({}, op);
  _sEq(v.error, null, 'params vazio é válido');
  _sOk(silasIsoEhDomingo_(v.params.data), 'data omitida resolve para um domingo');
  _sEq(v.params.visao, 'resumo', 'visão padrão é resumo');
  _sEq(v.params.limite, 50, 'limite padrão é 50');
}

function test_silas_paginacao() {
  var itens = [];
  for (var i = 0; i < 74; i++) itens.push({ issue_id: 'i' + i });
  var p = { limite: 50, area: null, periodo: null, visao: 'resumo' };
  var op = 'voluntarios.escalas.pendencias';

  var p1 = silasPaginar_(itens, p, op, '2026-09-27');
  _sEq(p1.pagination.returned, 50, 'primeira página traz 50');
  _sEq(p1.pagination.total, 74, 'total é do conjunto inteiro, não da página');
  _sEq(p1.pagination.has_more, true, 'sinaliza que há mais');

  var p2cfg = { limite: 50, area: null, periodo: null, visao: 'resumo', cursor: p1.pagination.next_cursor };
  var p2 = silasPaginar_(itens, p2cfg, op, '2026-09-27');
  _sEq(p2.pagination.returned, 24, 'segunda página traz o resto');
  _sEq(p2.pagination.has_more, false, 'fim da listagem');
  _sEq(p2.pagination.next_cursor, null, 'sem cursor no fim');
  _sEq(p2.items[0].issue_id, 'i50', 'continua de onde parou');

  // Escopo diferente com o mesmo cursor: dados mudaram → recomeçar.
  var p3 = silasPaginar_(itens.slice(0, 60), p2cfg, op, '2026-09-27');
  _sEq(p3.error, 'STALE_CURSOR', 'cursor de outro conjunto é recusado');

  var p4 = silasPaginar_(itens, { limite: 50, cursor: 'lixo!!' }, op, '2026-09-27');
  _sEq(p4.error, 'STALE_CURSOR', 'cursor ilegível é recusado');
}

function test_silas_onboarding() {
  var r = silasRoute_({
    api_version: '1', operation: 'voluntarios.onboarding.pendencias',
    auth: { token: PropertiesService.getScriptProperties().getProperty('SILAS_TOKEN') || '' }
  }, 200);
  _sOk(r.ok === false, 'onboarding não devolve sucesso');
  _sOk(r.error.code === 'NOTION_NOT_CONFIGURED' || r.error.code === 'UNAUTHENTICATED',
       'onboarding indisponível — nunca lista vazia');
  _sEq(r.meta.all_clear_allowed, false, 'onboarding indisponível não autoriza "tudo certo"');
}

// ============================ RUNNER ============================

function test_silas_todos() {
  _silasFalhas = [];
  test_silas_datas();
  test_silas_normalizacao();
  test_silas_cobertura();
  test_silas_roteador();
  test_silas_parametros();
  test_silas_paginacao();
  test_silas_onboarding();
  Logger.log('--------------------------------');
  if (_silasFalhas.length) {
    Logger.log('FALHARAM (' + _silasFalhas.length + '): ' + _silasFalhas.join(' | '));
    throw new Error(_silasFalhas.length + ' teste(s) falharam — ver log.');
  }
  Logger.log('TODOS OS TESTES PASSARAM');
}

/**
 * SMOKE DE PRODUÇÃO — SOMENTE LEITURA. Abre UMA área e mede o tempo.
 * Não escreve nada. Use para calibrar SILAS_CONFIG.DEADLINE_MS antes de expor
 * a integração; rodar fora da janela de culto.
 */
function test_silas_smoke_producao() {
  var alvo = silasProximoDomingo_(silasHojeIso_());
  var t = Date.now();
  var r = silasLerArea_(silasArea_('som'), alvo);
  Logger.log('área=som alvo=' + alvo + ' fonte=' + r.source_status +
             ' participações=' + r.assignments.length +
             ' telefones pendentes=' + r.phoneIssues.length +
             ' linhas inválidas=' + r.invalidRows.length +
             ' tempo=' + (Date.now() - t) + 'ms');
}

/** Mede as 12 áreas. Rodar UMA vez para dimensionar o orçamento de tempo. */
function test_silas_smoke_producao_todas() {
  var alvo = silasProximoDomingo_(silasHojeIso_());
  var t0 = Date.now();
  var r = silasLerAreas_(SILAS_CONFIG.AREAS.slice(), alvo, t0);
  Logger.log('alvo=' + alvo + ' fontes_ok=' + r.successful_source_count + '/12' +
             ' completo=' + r.read_complete +
             ' não verificadas=' + JSON.stringify(r.unverified_sources) +
             ' tempo total=' + (Date.now() - t0) + 'ms');
}
