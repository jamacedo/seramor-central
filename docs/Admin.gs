/**
 * Backend do Painel /admin — Igreja Ser Amor (Fase 6).
 * Implementa a §5 de docs/Especificacao_Fase6_Admin.md e espelha o contrato do
 * mock src/api/adminMock.ts. Arquivo INDEPENDENTE: reusa CONFIG e os helpers do
 * Code_otimizado.gs (ss_, ck_, loadRows_, findRow_, writeCell_, normalizePhone,
 * fmtStamp, toDateStr, diffMin, rowState, ok/err) — todos compartilham o mesmo
 * namespace global do projeto Apps Script.
 *
 * Roteamento: o Apps Script só permite UM doPost, que vive no Code_otimizado.gs.
 * Lá foram adicionados os 5 `case` que delegam para as funções abaixo.
 *
 * 5 ações: adminDashboard, adminSearch, adminCheckin, adminCheckout,
 * adminUpdatePhone.
 *
 * Auth (§2): token compartilhado. Defina a Script Property `ADMIN_TOKEN`; o
 * front/Worker envia `token` no corpo. Sem a property configurada, NÃO bloqueia
 * (modo dev) — configure-a para exigir o token em produção.
 *
 * Auditoria (§6): por ora só na coluna `Observações` da linha afetada
 * (`[manual: <operador> em DD/MM/YYYY HH:MM]`). Aba `Log Admin` fica como melhoria.
 */

// ============================ CONFIG ADMIN ============================

var ADMIN_CONFIG = {
  // Aba de cadastro (origem) dentro de cada planilha de área.
  SHEET_ORIGEM: 'Voluntários',
  COL_ORIGEM: {
    NOME: 'Nome completo',
    TELEFONE: 'Telefone',
    FUNCAO: 'Função',
    OBS: 'Observações',
    ATIVO: 'Ativo?',
    INICIO: 'Inicio'
  },

  // Área → spreadsheetId da planilha de origem (cadastro por área).
  ORIGEM: {
    'Transmissão':  '1yWlJy_ffiNCUAXMi3sfHlE4kqGgMiERfOx6NLFTYoLE',
    'Som':          '1rrNPCIuRG3_7oySFEKhXKcC1etl7IRFuwtp5Flbuios',
    'Multimídia':   '1riwyUOz_LOwG9lOz5I9spjsjKlL1o98QoJEYt0jUnu4',
    'Produção':     '1-w_OWPXlzp6t0d4-posKJ-xCCSM3SG90rI7tElLA5ds',
    'Louvor':       '176lC9i1Q2pIfSO-0WvXijpc1AJybZjqCm6DQebb3yJM',
    'Logística':    '1lo8T0h5v2YKvF4bGxGCfOUoRDV1waZhwvl5UJCEokdk',
    'Foto e Vídeo': '1bkC19i_ECpDKo1Jq0zLevjQHTFD-k_5X79Ta3tatSkc',
    'Clubinho':     '15yDqEdezVmBPuvgPlyvyIpWBFlxUiyVGew60YkhSW5c',
    'Central':      '15Jd0R5KjNnx-nN2ITCIfVlWx-zsifPPuMsg-Ng8WTMc',
    'Acolhimento':  '1ZNtJpMT7slGoVwqvfuCJFfRZVW-UfB23Uf5IUDpWeA4',
    'Iluminação':   '1QE7EY6Xg9l9P7cNBkHcyFQN4BEfIEgFXAt2FAiZs8Fc',
    'Ekoe':         '1AcNfXRl_zhpLDZFkFzDyuaEYSX2WPJvInQKWR_-kIDE'
  }
};

// ============================ AUTH (token) ============================

/** Gate de token. Retorna null se autorizado, ou um envelope de erro. */
function requireAdmin_(body) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!expected) return null; // sem token configurado → modo dev (não bloqueia)
  var got = (body && body.token) ? String(body.token) : '';
  if (got !== expected) return err('INVALID_INPUT', 'Não autorizado.');
  return null;
}

// ============================ AÇÕES ============================

/** F6-A · Visão global: contadores por área + % de comparecimento. */
function adminDashboard(body) {
  var gate = requireAdmin_(body); if (gate) return gate;

  var c = ck_();
  var dateStr = (body.data && String(body.data).trim()) || todayStr();
  var rows = loadRows_(c, dateRowNumbers_(c, dateStr));
  tlog('adminDashboard: ' + rows.length + ' linha(s) em ' + dateStr);

  var turno = body.turno ? String(body.turno).trim() : null;
  if (turno) rows = rows.filter(function (r) { return r.turno === turno; });

  var byArea = {}, order = [];
  var resumo = counts_();
  rows.forEach(function (r) {
    var a = byArea[r.area];
    if (!a) { a = counts_(); a.area = r.area; byArea[r.area] = a; order.push(r.area); }
    bump_(a, r);
    bump_(resumo, r);
  });

  var areas = order.map(function (k) {
    var a = byArea[k];
    a.comparecimento = ratio_(a);
    return a;
  });
  resumo.comparecimento = ratio_(resumo);

  return ok({ data: dateStr, resumo: resumo, areas: areas });
}

/** F6-B · Busca de escalados da data de referência (substring sem acento). */
function adminSearch(body) {
  var gate = requireAdmin_(body); if (gate) return gate;

  var c = ck_();
  var dateStr = (body.data && String(body.data).trim()) || todayStr();
  var rows = loadRows_(c, dateRowNumbers_(c, dateStr));

  var area = body.area ? String(body.area).trim() : null;
  var turno = body.turno ? String(body.turno).trim() : null;
  var q = deburr_(body.nome || '');

  var itens = rows
    .filter(function (r) { return (!area || r.area === area) && (!turno || r.turno === turno); })
    // Sem nome (<2 chars) lista todos que batem nos filtros de área/turno.
    .filter(function (r) { return q.length >= 2 ? deburr_(r.nome).indexOf(q) >= 0 : true; })
    .map(function (r) {
      var item = {
        nome: r.nome,
        telefone: r.telefone,
        escala: { telefone: r.telefone, data: dateStr, area: r.area, turno: r.turno, funcao: r.funcao },
        estado: rowState(r),
        ref: r.sheetRow // chave estável p/ check-in/out mesmo sem telefone
      };
      if (r.in) item.checkinAt = fmtStamp(r.checkin);
      if (r.out) item.checkoutAt = fmtStamp(r.checkout);
      return item;
    });

  return ok({ itens: itens });
}

/**
 * Localiza a linha-alvo de uma ação. Prioriza `ref` (nº da linha — funciona p/
 * quem está SEM telefone); valida área/turno (e nome, se enviado) contra
 * deslocamento de linhas. Sem `ref`, cai na chave por telefone (findRow_).
 */
function locateRow_(body) {
  if (body.ref) {
    var c = ck_();
    var rn = Number(body.ref);
    if (rn < 2 || rn > c.lastRow) return null;
    var v = c.sheet.getRange(rn, 1, 1, c.lastCol).getValues()[0];
    var row = parseRow_(c.idx, v, rn);
    if (String(row.area).trim() !== String(body.area).trim()) return null;
    if (String(row.turno).trim() !== String(body.turno).trim()) return null;
    if (body.nome && deburr_(row.nome) !== deburr_(body.nome)) return null;
    return row;
  }
  return findRow_(normalizePhone(body.telefone), body.data, body.area, body.turno);
}

/** F6-B · Check-in manual (já-In ⇒ erro, diferente do MVP idempotente). */
function adminCheckin(body) {
  var gate = requireAdmin_(body); if (gate) return gate;

  var loc = locateRow_(body);
  if (!loc) return err('ROW_NOT_FOUND', 'Escala não encontrada.');
  if (loc.in === true) return err('ALREADY_CHECKED_IN', 'Voluntário já fez check-in.');

  var now = new Date();
  var c = ck_();
  // Telefone opcional informado no check-in: grava SÓ se a linha estiver sem
  // telefone (não sobrescreve número existente — correção é via cadastro).
  // Propaga para os 3 lugares como o adminUpdatePhone: escala + origem (planilha
  // da área) + Base Voluntarios. Origem/base são best-effort (não barram o
  // check-in se o voluntário não estiver na base/origem).
  var telNovo = normalizePhone(body.telefoneNovo);
  if (telNovo.length === 11 && !normalizePhone(loc.telefone)) {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      checkinUpdatePhone_(loc.area, loc.nome, telNovo);   // escala (linhas da pessoa)
      originUpdatePhone_(loc.area, loc.nome, '', telNovo); // origem (área) — best-effort
      var base = baseCtx_();
      if (base) {
        var fb = findBaseRow_(base, loc.area, loc.nome);
        if (fb) base.sheet.getRange(fb.sheetRow, base.idx[CONFIG.COL_VOL.TELEFONE] + 1).setValue(telNovo);
      }
    } finally {
      lock.releaseLock();
    }
  }
  writeCell_(c, loc.sheetRow, CONFIG.COL.IN, true);
  writeCell_(c, loc.sheetRow, CONFIG.COL.CHECKIN, now);
  appendObs_(c, loc.sheetRow, auditTag_(body.operador, now));

  return ok({ nome: loc.nome, area: loc.area, checkinAt: fmtStamp(now), manual: true, operador: body.operador });
}

/** F6-B · Check-out manual. */
function adminCheckout(body) {
  var gate = requireAdmin_(body); if (gate) return gate;

  var loc = locateRow_(body);
  if (!loc) return err('ROW_NOT_FOUND', 'Escala não encontrada.');
  if (loc.in !== true) return err('NOT_CHECKED_IN', 'Faça o check-in antes da saída.');
  if (loc.out === true) return err('ALREADY_CHECKED_OUT', 'Voluntário já fez check-out.');

  var now = new Date();
  var c = ck_();
  writeCell_(c, loc.sheetRow, CONFIG.COL.OUT, true);
  writeCell_(c, loc.sheetRow, CONFIG.COL.CHECKOUT, now);
  appendObs_(c, loc.sheetRow, auditTag_(body.operador, now));

  return ok({
    nome: loc.nome, area: loc.area,
    checkinAt: fmtStamp(loc.checkin), checkoutAt: fmtStamp(now),
    duracaoMin: diffMin(loc.checkin, now),
    manual: true, operador: body.operador
  });
}

/**
 * F6-C · Atualização de telefone. Grava na origem (planilha de área) + na
 * Base Voluntarios (compilada). Localiza a origem por nome + telefone ATUAL para
 * não atualizar a pessoa errada. Sob LockService (escreve em 2 planilhas).
 */
function adminUpdatePhone(body) {
  var gate = requireAdmin_(body); if (gate) return gate;

  var parts = String(body.voluntarioId || '').split('::');
  var area = String(parts[0] || '').trim();
  var nome = String(parts.slice(1).join('::') || '').trim();
  var telNovo = normalizePhone(body.telefoneNovo);
  if (!area || !nome) return err('INVALID_INPUT', 'Voluntário inválido.');
  if (telNovo.length !== 11) return err('INVALID_INPUT', 'Telefone inválido (use 11 dígitos).');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var base = baseCtx_();
    if (!base) return err('SHEET_UNAVAILABLE', 'Base de voluntários indisponível.');

    var found = findBaseRow_(base, area, nome);
    if (!found) return err('VOLUNTEER_NOT_FOUND', 'Voluntário não encontrado na base.');
    var telAntigo = found.telefone;

    // Telefone novo não pode pertencer a OUTRO voluntário ativo.
    if (telNovo !== telAntigo && baseHasPhone_(base, telNovo, found.valueIndex)) {
      return err('DUPLICATE_PHONE', 'Telefone já cadastrado para outro voluntário.');
    }

    // 1) Origem (planilha da área): match por nome + telefone atual.
    if (!originUpdatePhone_(area, nome, telAntigo, telNovo)) {
      return err('ORIGIN_NOT_FOUND', 'Não foi possível atualizar na planilha da área.');
    }

    // 2) Compilada (Base Voluntarios): efeito imediato no /resolve.
    base.sheet.getRange(found.sheetRow, base.idx[CONFIG.COL_VOL.TELEFONE] + 1).setValue(telNovo);

    // 3) Escala (Checkin Ser Amor): as linhas da pessoa (mesma área) carregam o
    // telefone como chave; sem isto, o check-in/painel seguiriam com o número antigo.
    checkinUpdatePhone_(area, nome, telNovo);

    return ok({
      nome: found.nome, area: area,
      telefoneAntigo: telAntigo, telefoneNovo: telNovo,
      gravado: ['origem', 'base'], operador: body.operador
    });
  } finally {
    lock.releaseLock();
  }
}

// ====================== HELPERS — CHECKIN SHEET ======================

/** Nºs de linha (1-based) cuja coluna Data casa com `dateStr`. Lê só 1 coluna. */
function dateRowNumbers_(c, dateStr) {
  var dat = colValues_(c, CONFIG.COL.DATA);
  var target = String(dateStr).trim();
  var out = [];
  for (var i = 0; i < dat.length; i++) {
    if (toDateStr(dat[i][0]) === target) out.push(i + 2);
  }
  return out;
}

/** Anexa um marcador em `Observações`, preservando o conteúdo existente. */
function appendObs_(c, sheetRow, tag) {
  var col = c.idx[CONFIG.COL.OBSERVACOES];
  if (col === undefined) return;
  var cell = c.sheet.getRange(sheetRow, col + 1);
  var cur = String(cell.getValue() || '').trim();
  cell.setValue(cur ? cur + ' ' + tag : tag);
}

function auditTag_(operador, when) {
  return '[manual: ' + (operador || '?') + ' em ' + fmtStamp(when) + ']';
}

// ====================== HELPERS — CHECKIN (escala) ======================

/**
 * Atualiza o `Telefone` das linhas da aba `Checkin Ser Amor` que pertencem ao
 * voluntário (mesmo `Voluntário` + `Área`). Retorna quantas linhas mudaram.
 * Lê só as colunas Voluntário/Área para decidir; escreve célula a célula.
 */
function checkinUpdatePhone_(area, nome, telNovo) {
  var c = ck_();
  var nomes = colValues_(c, CONFIG.COL.VOLUNTARIO);
  var areas = colValues_(c, CONFIG.COL.AREA);
  var alvo = deburr_(nome);
  var n = 0;
  for (var i = 0; i < nomes.length; i++) {
    if (deburr_(nomes[i][0]) === alvo && String(areas[i][0]).trim() === area) {
      writeCell_(c, i + 2, CONFIG.COL.TELEFONE, telNovo);
      n++;
    }
  }
  return n;
}

// ====================== HELPERS — BASE VOLUNTARIOS ======================

/** Lê a Base Voluntarios uma vez (não é polling). Retorna ctx ou null. */
function baseCtx_() {
  var sheet = ss_().getSheetByName(CONFIG.SHEET_VOLUNTARIOS);
  if (!sheet) return null;
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var idx = {}; headers.forEach(function (h, i) { idx[h] = i; });
  var values = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return { sheet: sheet, idx: idx, values: values };
}

/** Localiza a linha ativa por Área + Nome (nome tolerante a acento/caixa). */
function findBaseRow_(base, area, nome) {
  var iNome = base.idx[CONFIG.COL_VOL.NOME];
  var iArea = base.idx[CONFIG.COL_VOL.AREA];
  var iTel = base.idx[CONFIG.COL_VOL.TELEFONE];
  var iAtivo = base.idx[CONFIG.COL_VOL.ATIVO];
  var alvo = deburr_(nome);
  for (var i = 0; i < base.values.length; i++) {
    var v = base.values[i];
    if (iAtivo !== undefined && v[iAtivo] === false) continue;
    if (String(v[iArea]).trim() === area && deburr_(v[iNome]) === alvo) {
      return {
        valueIndex: i,
        sheetRow: i + 2,
        nome: v[iNome],
        telefone: normalizePhone(v[iTel])
      };
    }
  }
  return null;
}

/** Algum OUTRO voluntário ativo já usa este telefone? */
function baseHasPhone_(base, phone, exceptIndex) {
  var iTel = base.idx[CONFIG.COL_VOL.TELEFONE];
  var iAtivo = base.idx[CONFIG.COL_VOL.ATIVO];
  for (var i = 0; i < base.values.length; i++) {
    if (i === exceptIndex) continue;
    var v = base.values[i];
    if (iAtivo !== undefined && v[iAtivo] === false) continue;
    if (normalizePhone(v[iTel]) === phone) return true;
  }
  return false;
}

// ====================== HELPERS — ORIGEM (planilha da área) ======================

/**
 * Atualiza o telefone na aba `Voluntários` da planilha da área.
 * Casa pela combinação nome + telefone ATUAL; se o telefone atual estiver vazio,
 * exige que o nome seja único na origem. Retorna true se gravou.
 */
function originUpdatePhone_(area, nome, telAntigo, telNovo) {
  var id = ADMIN_CONFIG.ORIGEM[area];
  if (!id) return false;
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName(ADMIN_CONFIG.SHEET_ORIGEM);
  if (!sheet) return false;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return false;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var idx = {}; headers.forEach(function (h, i) { idx[h] = i; });
  var iNome = idx[ADMIN_CONFIG.COL_ORIGEM.NOME];
  var iTel = idx[ADMIN_CONFIG.COL_ORIGEM.TELEFONE];
  if (iNome === undefined || iTel === undefined) return false;

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var alvo = deburr_(nome);
  var matches = [];
  for (var i = 0; i < values.length; i++) {
    if (deburr_(values[i][iNome]) !== alvo) continue;
    if (telAntigo && normalizePhone(values[i][iTel]) !== telAntigo) continue;
    matches.push(i);
  }
  if (matches.length !== 1) return false; // 0 = não achou; >1 = ambíguo (não adivinha)

  sheet.getRange(matches[0] + 2, iTel + 1).setValue(telNovo);
  return true;
}

// ============================ HELPERS GERAIS ============================

/** Contadores zerados (StatusCounts). */
function counts_() {
  return { escalados: 0, pendentes: 0, emServico: 0, concluidos: 0, comparecimento: 0 };
}

/** Incrementa contadores conforme o estado da linha. */
function bump_(a, r) {
  a.escalados += 1;
  var st = rowState(r);
  if (st === 'IN_SERVICE') a.emServico += 1;
  else if (st === 'DONE') a.concluidos += 1;
  else a.pendentes += 1;
}

/** % comparecimento = (em serviço + concluídos) / escalados. */
function ratio_(a) {
  return a.escalados === 0 ? 0 : (a.emServico + a.concluidos) / a.escalados;
}

/** Normaliza para busca: sem acento, minúsculo, trim. */
function deburr_(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// ============================ TESTES (rodar no editor) ============================
// Defina a Script Property ADMIN_TOKEN como '' (ou apague) para testar sem token,
// ou inclua `token` nos corpos abaixo.

function test_adminDashboard() {
  Logger.log(JSON.stringify(adminDashboard({ action: 'adminDashboard', operador: 'teste@seramor' }), null, 2));
}

function test_adminSearch() {
  Logger.log(JSON.stringify(adminSearch({ action: 'adminSearch', operador: 'teste@seramor', nome: '' }), null, 2));
}

function test_adminCheckin() {
  // Ajuste telefone/data/area/turno para uma linha real de hoje antes de rodar.
  Logger.log(JSON.stringify(adminCheckin({
    action: 'adminCheckin', operador: 'teste@seramor',
    telefone: '11999990002', data: todayStr(), area: 'Louvor', turno: 'Manhã'
  }), null, 2));
}

function test_adminUpdatePhone() {
  Logger.log(JSON.stringify(adminUpdatePhone({
    action: 'adminUpdatePhone', operador: 'teste@seramor',
    voluntarioId: 'Louvor::Maria Oliveira', telefoneNovo: '11988887777'
  }), null, 2));
}
