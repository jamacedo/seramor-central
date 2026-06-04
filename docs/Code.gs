/**
 * Backend de Check-in — Igreja Ser Amor
 * Implementa o Contrato de API v1.2 (Apps Script Web App).
 *
 * Deploy: Implantar > Nova implantação > Tipo "App da Web".
 *   - Executar como: Eu (dono)
 *   - Quem tem acesso: Qualquer pessoa  (o app valida pelo telefone)
 *
 * Roteamento: um único doPost, despachado pelo campo "action".
 * Estados: NOT_FOUND, NOT_SCHEDULED, CAN_CHECKIN, IN_SERVICE, DONE, MULTIPLE.
 */

// ============================ CONFIG ============================

var CONFIG = {
  SPREADSHEET_ID: '10lmOfSE4O8CnJOmyZ96i0f2k26uDxrV5QCEP9DlurRA',
  SHEET_CHECKIN: 'Checkin Ser Amor',
  SHEET_VOLUNTARIOS: 'Base Voluntarios', // índice compilado pelo App Script de consolidação
  TZ: 'America/Sao_Paulo',

  // Cabeçalhos esperados na aba de check-in (devem casar exatamente com a planilha)
  COL: {
    IN: 'In', OUT: 'Out', VOLUNTARIO: 'Voluntário', FUNCAO: 'Função',
    TURNO: 'Turno', DATA: 'Data', CHECKIN: 'Checkin', CHECKOUT: 'Checkout',
    OBSERVACOES: 'Observações', TELEFONE: 'Telefone', AREA: 'Área'
  },

  // Cabeçalhos esperados na aba de índice de voluntários
  COL_VOL: { TELEFONE: 'Telefone', NOME: 'Nome', AREA: 'Área', FUNCAO: 'Função', ATIVO: 'Ativo' },

  // Janelas de turno [horaInicio, horaFim) em horas decimais
  TURNOS: { 'Manhã': [6, 13], 'Noite': [15, 22] }
};

// ============================ ENTRYPOINTS ============================

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (body.action) {
      case 'resolve':                 return json(resolve(body));
      case 'checkin':                 return json(checkin(body));
      case 'checkout':                return json(checkout(body));
      case 'registerOutsideSchedule': return json(registerOutsideSchedule(body));
      default:                        return json(err('INVALID_INPUT', 'Ação desconhecida.'));
    }
  } catch (ex) {
    return json(err('SHEET_UNAVAILABLE', 'Erro inesperado: ' + ex.message));
  }
}

function doGet() {
  // Health check. Se for servir a SPA pelo próprio Apps Script, troque por HtmlService.
  return json({ ok: true, data: { service: 'checkin-ser-amor', status: 'up' }, error: null });
}

// ============================ AÇÕES ============================

function resolve(body) {
  var phone = normalizePhone(body.telefone);
  if (!phone) return err('INVALID_INPUT', 'Telefone inválido.');

  var rows = todayRowsForPhone(phone);

  // Sem escala hoje → fallback no índice de voluntários
  if (rows.length === 0) {
    var vol = lookupVolunteer(phone);
    if (!vol) {
      return state('NOT_FOUND', {
        message: 'Não encontramos este número na nossa base de voluntários. Por favor, procure o líder do seu ministério para atualizar seu cadastro.'
      });
    }
    return state('NOT_SCHEDULED', {
      nome: vol.nome,
      podeRegistrarForaDaEscala: true,
      areaSugerida: vol.area,
      funcaoSugerida: vol.funcao,
      message: 'Olá, ' + firstName(vol.nome) + '! Não localizamos você na escala de hoje. Caso tenha sido escalado, por favor, procure o líder do ministério.'
    });
  }

  // Mais de uma escala hoje → tenta desempatar pelo horário
  if (rows.length > 1) {
    var t = inferTurno(new Date());
    var matched = rows.filter(function (r) { return r.turno === t; });
    if (matched.length === 1) {
      rows = matched;
    } else {
      return state('MULTIPLE', {
        nome: rows[0].nome,
        opcoes: rows.map(function (r) {
          var o = { data: r.data, area: r.area, turno: r.turno, funcao: r.funcao, estado: rowState(r) };
          if (r.in) o.checkinAt = fmtStamp(r.checkin);
          return o;
        })
      });
    }
  }

  // Escala única → estado pela flag
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
  var phone = normalizePhone(body.telefone);
  var loc = findRow(phone, body.data, body.area, body.turno);
  if (!loc) return err('ROW_NOT_FOUND', 'Não encontramos sua escala.');

  if (loc.row.in === true) {
    return ok({ nome: loc.row.nome, area: loc.row.area, checkinAt: fmtStamp(loc.row.checkin) });
  }
  var now = new Date();
  setCell(loc.sheetRow, CONFIG.COL.IN, true);
  setCell(loc.sheetRow, CONFIG.COL.CHECKIN, now);
  return ok({ nome: loc.row.nome, area: loc.row.area, checkinAt: fmtStamp(now) });
}

function checkout(body) {
  var phone = normalizePhone(body.telefone);
  var loc = findRow(phone, body.data, body.area, body.turno);
  if (!loc) return err('ROW_NOT_FOUND', 'Não encontramos sua escala.');

  if (loc.row.in !== true) return err('NOT_CHECKED_IN', 'Faça o check-in antes de registrar a saída.');
  if (loc.row.out === true) {
    return ok({
      nome: loc.row.nome, area: loc.row.area,
      checkinAt: fmtStamp(loc.row.checkin), checkoutAt: fmtStamp(loc.row.checkout),
      duracaoMin: diffMin(loc.row.checkin, loc.row.checkout)
    });
  }
  var now = new Date();
  setCell(loc.sheetRow, CONFIG.COL.OUT, true);
  setCell(loc.sheetRow, CONFIG.COL.CHECKOUT, now);
  return ok({
    nome: loc.row.nome, area: loc.row.area,
    checkinAt: fmtStamp(loc.row.checkin), checkoutAt: fmtStamp(now),
    duracaoMin: diffMin(loc.row.checkin, now)
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
    var today = todayStr();
    // Evita duplicar registro do mesmo telefone/área/turno hoje
    if (findRow(phone, today, body.area, body.turno)) {
      return err('DUPLICATE', 'Já existe um registro seu para hoje nesta área.');
    }
    var sheet = sheetCheckin();
    var headers = getHeaders(sheet);
    var now = new Date();
    var rowArr = new Array(headers.length).fill('');
    setArr(rowArr, headers, CONFIG.COL.IN, true);
    setArr(rowArr, headers, CONFIG.COL.CHECKIN, now);
    setArr(rowArr, headers, CONFIG.COL.VOLUNTARIO, vol.nome);
    setArr(rowArr, headers, CONFIG.COL.TELEFONE, phone);
    setArr(rowArr, headers, CONFIG.COL.DATA, today);
    setArr(rowArr, headers, CONFIG.COL.AREA, body.area);
    setArr(rowArr, headers, CONFIG.COL.TURNO, body.turno);
    setArr(rowArr, headers, CONFIG.COL.FUNCAO, body.funcao || vol.funcao || '');
    setArr(rowArr, headers, CONFIG.COL.OBSERVACOES, String(body.motivo).trim());
    sheet.appendRow(rowArr);
    return ok({ nome: vol.nome, area: body.area, checkinAt: fmtStamp(now), observacao: String(body.motivo).trim() });
  } finally {
    lock.releaseLock();
  }
}

// ============================ LEITURA / ESCRITA ============================

function sheetCheckin() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEET_CHECKIN);
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}

/** Lê todas as linhas da aba de check-in como objetos, guardando o nº da linha na planilha. */
function readCheckinRows() {
  var sheet = sheetCheckin();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var headers = getHeaders(sheet);
  var values = sheet.getRange(2, 1, last - 1, headers.length).getValues();
  var idx = headerIndex(headers);
  return values.map(function (v, i) {
    return {
      sheetRow: i + 2,
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
  });
}

function todayRowsForPhone(phone) {
  var today = todayStr();
  return readCheckinRows().filter(function (r) { return r.telefone === phone && r.data === today; });
}

/** Localiza UMA linha pela chave única Telefone+Data+Área+Turno. */
function findRow(phone, dataStr, area, turno) {
  var rows = readCheckinRows();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.telefone === phone && r.data === dataStr &&
        r.area === String(area).trim() && r.turno === String(turno).trim()) {
      return { row: r, sheetRow: r.sheetRow };
    }
  }
  return null;
}

function setCell(sheetRow, colName, value) {
  var sheet = sheetCheckin();
  var headers = getHeaders(sheet);
  var col = headers.indexOf(colName) + 1;
  sheet.getRange(sheetRow, col).setValue(value);
}

/** Índice de voluntários (fallback). Retorna {nome, area, funcao} ou null. */
function lookupVolunteer(phone) {
  var sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEET_VOLUNTARIOS);
  if (!sheet) return null;
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var headers = getHeaders(sheet);
  var idx = headerIndex(headers);
  var values = sheet.getRange(2, 1, last - 1, headers.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (normalizePhone(v[idx[CONFIG.COL_VOL.TELEFONE]]) === phone) {
      var ativo = v[idx[CONFIG.COL_VOL.ATIVO]];
      if (ativo === false) continue; // ignora inativos
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

function headerIndex(headers) {
  var map = {};
  headers.forEach(function (h, i) { map[h] = i; });
  return map;
}

function setArr(arr, headers, colName, value) {
  var i = headers.indexOf(colName);
  if (i >= 0) arr[i] = value;
}

/** Telefone → string de 11 dígitos (descarta DDI 55 se vier). */
function normalizePhone(raw) {
  if (raw === null || raw === undefined) return '';
  var d = String(raw).replace(/\D/g, '');
  if (d.length === 13 && d.indexOf('55') === 0) d = d.substring(2);
  if (d.length === 12 && d.indexOf('55') === 0) d = d.substring(2); // fixo/edge
  return d.length === 11 ? d : (d.length === 10 ? d : d); // mantém para comparação tolerante
}

/** Data atual em DD/MM/YYYY no fuso de SP. */
function todayStr() {
  return Utilities.formatDate(new Date(), CONFIG.TZ, 'dd/MM/yyyy');
}

/** Valor de célula (Date ou string) → DD/MM/YYYY. */
function toDateStr(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'dd/MM/yyyy');
  return String(v).trim();
}

/** Carimbo (Date ou string) → DD/MM/YYYY HH:MM. */
function fmtStamp(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'dd/MM/yyyy HH:mm');
  return String(v).trim();
}

/** Diferença em minutos entre dois carimbos (Date ou string DD/MM/YYYY HH:MM). */
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

/** Turno pela hora atual; null no gap (13–15), fora do horário, etc. */
function inferTurno(now) {
  var h = now.getHours() + now.getMinutes() / 60;
  for (var t in CONFIG.TURNOS) {
    var w = CONFIG.TURNOS[t];
    if (h >= w[0] && h < w[1]) return t;
  }
  return null;
}

function firstName(nome) { return String(nome || '').trim().split(/\s+/)[0]; }

// ----- Envelopes de resposta -----
function ok(data)            { return { ok: true, data: data, error: null }; }
function state(st, data)     { return { ok: true, state: st, data: data, error: null }; }
function err(code, message)  { return { ok: false, error: { code: code, message: message } }; }

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
