/**
 * Backend de Check-in — Igreja Ser Amor (VERSÃO OTIMIZADA)
 * Implementa o Contrato de API v1.2 (Apps Script Web App).
 *
 * Otimizações vs. Code.gs original (alvo: derrubar a latência de ~7–15s):
 *  1) Abre a planilha UMA vez por execução (memoização _ss/_ck) — antes reabria
 *     várias vezes (openById é caro).
 *  2) Lê só a coluna "Telefone" para filtrar e carrega a LINHA INTEIRA apenas
 *     para as poucas linhas que casam — antes lia ~3.300 linhas × 14 colunas a
 *     cada chamada (e às vezes 2× somando a Base Voluntários).
 *  3) Cabeçalhos lidos uma única vez (idx memoizado).
 *  4) Escrita sem reler cabeçalho (usa o idx).
 *  5) NOT_FOUND/NOT_SCHEDULED não enviam "message" — a cópia é do frontend.
 *  6) CONFIG.DEBUG=true loga tempos por etapa no painel de Execuções.
 *  7) SPREADSHEET_ID por Script Properties (evita misturar homolog/produção).
 *
 * Setup do ID (recomendado): Configurações do projeto → Propriedades do script
 *   → adicionar "SPREADSHEET_ID" = <id da planilha do ambiente>.
 *   (Como fallback, dá para preencher CONFIG.SPREADSHEET_ID abaixo.)
 *
 * Deploy: Implantar → Gerenciar implantações → editar a existente (✏️)
 *   → Versão: "Nova versão" → Implantar. (NÃO "Nova implantação".)
 */

// ============================ CONFIG ============================

var CONFIG = {
  // Preferir Script Properties. Se preferir cravar, coloque o ID aqui:
  SPREADSHEET_ID: '',
  SHEET_CHECKIN: 'Checkin Ser Amor',
  SHEET_VOLUNTARIOS: 'Base Voluntarios',
  TZ: 'America/Sao_Paulo',
  DEBUG: false, // true → loga tempos por etapa (Execuções)

  COL: {
    IN: 'In', OUT: 'Out', VOLUNTARIO: 'Voluntário', FUNCAO: 'Função',
    TURNO: 'Turno', DATA: 'Data', CHECKIN: 'Checkin', CHECKOUT: 'Checkout',
    OBSERVACOES: 'Observações', TELEFONE: 'Telefone', AREA: 'Área'
  },
  COL_VOL: { TELEFONE: 'Telefone', NOME: 'Nome', AREA: 'Área', FUNCAO: 'Função', ATIVO: 'Ativo' },

  TURNOS: { 'Manhã': [6, 13], 'Noite': [15, 22] }
};

// ====================== MEMOIZAÇÃO / TEMPO ======================
// Globais reinicializam a cada execução do Web App → cache por requisição.

var _t0 = null;
function tlog(msg) {
  if (!CONFIG.DEBUG) return;
  if (_t0 === null) _t0 = Date.now();
  Logger.log('+' + (Date.now() - _t0) + 'ms  ' + msg);
}

var _ss = null;
function ss_() {
  if (_ss) return _ss;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || CONFIG.SPREADSHEET_ID;
  if (!id) throw new Error('SPREADSHEET_ID não definido (Script Properties ou CONFIG).');
  _ss = SpreadsheetApp.openById(id);
  tlog('openById');
  return _ss;
}

var _ck = null; // contexto da aba de check-in (sheet, dimensões, cabeçalhos)
function ck_() {
  if (_ck) return _ck;
  var sheet = ss_().getSheetByName(CONFIG.SHEET_CHECKIN);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var idx = {}; headers.forEach(function (h, i) { idx[h] = i; });
  _ck = { sheet: sheet, lastRow: lastRow, lastCol: lastCol, headers: headers, idx: idx };
  tlog('ck_ pronto (lastRow=' + lastRow + ')');
  return _ck;
}

// ============================ ENTRYPOINTS ============================

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var res;
    switch (body.action) {
      case 'resolve':                 res = resolve(body); break;
      case 'checkin':                 res = checkin(body); break;
      case 'checkout':                res = checkout(body); break;
      case 'registerOutsideSchedule': res = registerOutsideSchedule(body); break;
      default:                        res = err('INVALID_INPUT', 'Ação desconhecida.');
    }
    tlog('fim ' + body.action);
    return json(res);
  } catch (ex) {
    return json(err('SHEET_UNAVAILABLE', 'Erro inesperado: ' + ex.message));
  }
}

function doGet() {
  return json({ ok: true, data: { service: 'checkin-ser-amor', status: 'up' }, error: null });
}

// ============================ AÇÕES ============================

function resolve(body) {
  var phone = normalizePhone(body.telefone);
  if (!phone) return err('INVALID_INPUT', 'Telefone inválido.');

  var c = ck_();
  var today = todayStr();
  var nums = phoneDateRowNumbers_(c, phone, today); // só linhas do telefone+hoje
  tlog('resolve: ' + nums.length + ' linha(s) hoje');

  if (nums.length === 0) {
    var vol = lookupVolunteer(phone);
    if (!vol) return state('NOT_FOUND', {});
    return state('NOT_SCHEDULED', {
      nome: vol.nome,
      podeRegistrarForaDaEscala: true,
      areaSugerida: vol.area,
      funcaoSugerida: vol.funcao
    });
  }

  var rows = loadRows_(c, nums);

  if (rows.length > 1) {
    // Desambiguação refinada:
    //  - Áreas distintas        → sempre MULTIPLE (escolha explícita).
    //  - Mesma área:
    //      * turno em aberto de OUTRO turno (esqueceu de fechar) → MULTIPLE
    //        (mostra ambos p/ concluir);
    //      * senão, se a hora cai na janela de exatamente um turno → vai direto;
    //      * senão (gap/fora de horário)                         → MULTIPLE.
    var areas = {};
    rows.forEach(function (r) { areas[r.area] = true; });
    var multiArea = Object.keys(areas).length > 1;

    var t = inferTurno(new Date());
    var abertoOutroTurno = rows.some(function (r) {
      return r.in === true && r.out !== true && r.turno !== t;
    });
    var atual = (t === null) ? [] : rows.filter(function (r) { return r.turno === t; });

    if (!multiArea && !abertoOutroTurno && atual.length === 1) {
      rows = atual; // resolve direto o turno atual (cai no bloco de escala única)
    } else {
      return state('MULTIPLE', {
        nome: rows[0].nome,
        opcoes: rows.map(function (r) {
          var o = { data: r.data, area: r.area, turno: r.turno, funcao: r.funcao, estado: rowState(r) };
          if (r.in) o.checkinAt = fmtStamp(r.checkin);
          if (r.out) o.checkoutAt = fmtStamp(r.checkout);
          return o;
        })
      });
    }
  }

  var row = rows[0];
  var st = rowState(row);
  var data = {
    nome: row.nome,
    escala: { telefone: phone, data: row.data, area: row.area, turno: row.turno, funcao: row.funcao }
  };
  if (st === 'IN_SERVICE') data.checkinAt = fmtStamp(row.checkin);
  if (st === 'DONE') { data.checkinAt = fmtStamp(row.checkin); data.checkoutAt = fmtStamp(row.checkout); }
  return state(st, data);
}

function checkin(body) {
  var loc = findRow_(normalizePhone(body.telefone), body.data, body.area, body.turno);
  if (!loc) return err('ROW_NOT_FOUND', 'Não encontramos sua escala.');
  if (loc.in === true) {
    return ok({ nome: loc.nome, area: loc.area, checkinAt: fmtStamp(loc.checkin) });
  }
  var now = new Date();
  writeCell_(ck_(), loc.sheetRow, CONFIG.COL.IN, true);
  writeCell_(ck_(), loc.sheetRow, CONFIG.COL.CHECKIN, now);
  return ok({ nome: loc.nome, area: loc.area, checkinAt: fmtStamp(now) });
}

function checkout(body) {
  var loc = findRow_(normalizePhone(body.telefone), body.data, body.area, body.turno);
  if (!loc) return err('ROW_NOT_FOUND', 'Não encontramos sua escala.');
  if (loc.in !== true) return err('NOT_CHECKED_IN', 'Faça o check-in antes de registrar a saída.');
  if (loc.out === true) {
    return ok({
      nome: loc.nome, area: loc.area,
      checkinAt: fmtStamp(loc.checkin), checkoutAt: fmtStamp(loc.checkout),
      duracaoMin: diffMin(loc.checkin, loc.checkout)
    });
  }
  var now = new Date();
  writeCell_(ck_(), loc.sheetRow, CONFIG.COL.OUT, true);
  writeCell_(ck_(), loc.sheetRow, CONFIG.COL.CHECKOUT, now);
  return ok({
    nome: loc.nome, area: loc.area,
    checkinAt: fmtStamp(loc.checkin), checkoutAt: fmtStamp(now),
    duracaoMin: diffMin(loc.checkin, now)
  });
}

function registerOutsideSchedule(body) {
  var phone = normalizePhone(body.telefone);
  if (!phone) return err('INVALID_INPUT', 'Telefone inválido.');
  if (!body.motivo || !String(body.motivo).trim()) return err('MISSING_REASON', 'Informe o motivo.');

  var vol = lookupVolunteer(phone);
  if (!vol) return err('NOT_REGISTERED', 'Telefone não cadastrado. Procure o líder.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var c = ck_();
    var today = todayStr();
    if (findRow_(phone, today, body.area, body.turno)) {
      return err('DUPLICATE', 'Já existe um registro seu para hoje nesta área.');
    }
    var now = new Date();
    var rowArr = new Array(c.headers.length).fill('');
    setArr_(rowArr, c.idx, CONFIG.COL.IN, true);
    setArr_(rowArr, c.idx, CONFIG.COL.CHECKIN, now);
    setArr_(rowArr, c.idx, CONFIG.COL.VOLUNTARIO, vol.nome);
    setArr_(rowArr, c.idx, CONFIG.COL.TELEFONE, phone);
    setArr_(rowArr, c.idx, CONFIG.COL.DATA, today);
    setArr_(rowArr, c.idx, CONFIG.COL.AREA, body.area);
    setArr_(rowArr, c.idx, CONFIG.COL.TURNO, body.turno);
    setArr_(rowArr, c.idx, CONFIG.COL.FUNCAO, body.funcao || vol.funcao || '');
    setArr_(rowArr, c.idx, CONFIG.COL.OBSERVACOES, String(body.motivo).trim());
    c.sheet.appendRow(rowArr);
    return ok({ nome: vol.nome, area: body.area, checkinAt: fmtStamp(now), observacao: String(body.motivo).trim() });
  } finally {
    lock.releaseLock();
  }
}

// ====================== LEITURA OTIMIZADA ======================

/** Lê UMA coluna inteira (por nome de cabeçalho). Retorna [][1] (linhas 2..last). */
function colValues_(c, colName) {
  if (c.lastRow < 2) return [];
  var col = c.idx[colName];
  if (col === undefined) return [];
  return c.sheet.getRange(2, col + 1, c.lastRow - 1, 1).getValues();
}

/** Nºs de linha (1-based) cujo Telefone normaliza para `phone`. Lê só 1 coluna. */
function phoneRowNumbers_(c, phone) {
  var tel = colValues_(c, CONFIG.COL.TELEFONE);
  var out = [];
  for (var i = 0; i < tel.length; i++) {
    if (normalizePhone(tel[i][0]) === phone) out.push(i + 2);
  }
  return out;
}

/**
 * Nºs de linha do telefone que TAMBÉM batem com `dateStr`.
 * Lê a coluna Telefone; só lê a coluna Data se houver telefone casando.
 */
function phoneDateRowNumbers_(c, phone, dateStr) {
  var tel = colValues_(c, CONFIG.COL.TELEFONE);
  var hits = [];
  for (var i = 0; i < tel.length; i++) {
    if (normalizePhone(tel[i][0]) === phone) hits.push(i);
  }
  if (!hits.length) return [];
  var dat = colValues_(c, CONFIG.COL.DATA);
  var target = String(dateStr).trim();
  var out = [];
  for (var k = 0; k < hits.length; k++) {
    var i2 = hits[k];
    if (toDateStr(dat[i2][0]) === target) out.push(i2 + 2);
  }
  return out;
}

/** Carrega as linhas inteiras (como objetos) só para os nºs informados. */
function loadRows_(c, rowNums) {
  var rows = [];
  for (var k = 0; k < rowNums.length; k++) {
    var rn = rowNums[k];
    var v = c.sheet.getRange(rn, 1, 1, c.lastCol).getValues()[0];
    rows.push(parseRow_(c.idx, v, rn));
  }
  return rows;
}

function parseRow_(idx, v, sheetRow) {
  return {
    sheetRow: sheetRow,
    in: v[idx[CONFIG.COL.IN]] === true,
    out: v[idx[CONFIG.COL.OUT]] === true,
    nome: v[idx[CONFIG.COL.VOLUNTARIO]],
    funcao: v[idx[CONFIG.COL.FUNCAO]],
    turno: String(v[idx[CONFIG.COL.TURNO]]).trim(),
    data: toDateStr(v[idx[CONFIG.COL.DATA]]),
    checkin: v[idx[CONFIG.COL.CHECKIN]],
    checkout: v[idx[CONFIG.COL.CHECKOUT]],
    telefone: normalizePhone(v[idx[CONFIG.COL.TELEFONE]]),
    area: String(v[idx[CONFIG.COL.AREA]]).trim()
  };
}

/** Localiza UMA linha pela chave Telefone+Data+Área+Turno (lê só o necessário). */
function findRow_(phone, dataStr, area, turno) {
  var c = ck_();
  var nums = phoneDateRowNumbers_(c, phone, String(dataStr).trim());
  if (!nums.length) return null;
  var rows = loadRows_(c, nums);
  area = String(area).trim(); turno = String(turno).trim();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].area === area && rows[i].turno === turno) return rows[i];
  }
  return null;
}

/** Escreve UMA célula usando o idx memoizado (sem reler cabeçalho). */
function writeCell_(c, sheetRow, colName, value) {
  var col = c.idx[colName];
  if (col === undefined) return;
  c.sheet.getRange(sheetRow, col + 1).setValue(value);
}

/** Índice de voluntários (fallback). Lê só a coluna Telefone + a linha que casa. */
function lookupVolunteer(phone) {
  var sheet = ss_().getSheetByName(CONFIG.SHEET_VOLUNTARIOS);
  if (!sheet) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var idx = {}; headers.forEach(function (h, i) { idx[h] = i; });
  var telCol = idx[CONFIG.COL_VOL.TELEFONE];
  if (telCol === undefined) return null;

  var tel = sheet.getRange(2, telCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < tel.length; i++) {
    if (normalizePhone(tel[i][0]) === phone) {
      var v = sheet.getRange(i + 2, 1, 1, lastCol).getValues()[0];
      if (v[idx[CONFIG.COL_VOL.ATIVO]] === false) continue; // ignora inativo, segue procurando
      return {
        nome: v[idx[CONFIG.COL_VOL.NOME]],
        area: v[idx[CONFIG.COL_VOL.AREA]],
        funcao: v[idx[CONFIG.COL_VOL.FUNCAO]]
      };
    }
  }
  return null;
}

// ============================ HELPERS ============================

function rowState(r) {
  if (r.in === true && r.out === true) return 'DONE';
  if (r.in === true) return 'IN_SERVICE';
  return 'CAN_CHECKIN';
}

function setArr_(arr, idx, colName, value) {
  var i = idx[colName];
  if (i !== undefined) arr[i] = value;
}

/** Telefone → string de 11 dígitos (descarta DDI 55 se vier). */
function normalizePhone(raw) {
  if (raw === null || raw === undefined) return '';
  var d = String(raw).replace(/\D/g, '');
  if (d.length === 13 && d.indexOf('55') === 0) d = d.substring(2);
  return d.length === 11 ? d : d; // mantém para comparação tolerante
}

function todayStr() {
  return Utilities.formatDate(new Date(), CONFIG.TZ, 'dd/MM/yyyy');
}

function toDateStr(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'dd/MM/yyyy');
  return String(v).trim();
}

function fmtStamp(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'dd/MM/yyyy HH:mm');
  return String(v).trim();
}

function diffMin(a, b) {
  var da = (a instanceof Date) ? a : parseStamp(a);
  var db = (b instanceof Date) ? b : parseStamp(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / 60000);
}

function parseStamp(s) {
  var m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
}

/** Turno pela hora atual (em SP, robusto ao fuso do projeto); null no gap. */
function inferTurno(now) {
  var h = Number(Utilities.formatDate(now, CONFIG.TZ, 'H')) +
          Number(Utilities.formatDate(now, CONFIG.TZ, 'm')) / 60;
  for (var t in CONFIG.TURNOS) {
    var w = CONFIG.TURNOS[t];
    if (h >= w[0] && h < w[1]) return t;
  }
  return null;
}

// ----- Envelopes -----
function ok(data)           { return { ok: true, data: data, error: null }; }
function state(st, data)    { return { ok: true, state: st, data: data, error: null }; }
function err(code, message) { return { ok: false, error: { code: code, message: message } }; }

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
