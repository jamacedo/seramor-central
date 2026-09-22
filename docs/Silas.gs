/**
 * Integração Silas/Hermes (Fase 7) — consultas de escala SOMENTE LEITURA.
 * Implementa docs/Especificacao_Fase7_Silas.md (contrato v1).
 *
 * Arquivo INDEPENDENTE, no mesmo namespace global do projeto Apps Script.
 * Reusa de Code_otimizado.gs: CONFIG.TZ. Reusa de Admin.gs: ADMIN_CONFIG.ORIGEM
 * (mapa canônico Área→spreadsheetId — NÃO duplicar esse cadastro aqui).
 *
 * Roteamento: o Apps Script só permite UM doPost, que vive no Code_otimizado.gs.
 * Lá foi adicionado um desvio ANTES do switch de `action`: corpo com
 * `operation` cai em silasRoute_(). Assim a credencial de leitura do Silas
 * nunca alcança uma ação de escrita, mesmo com parâmetros manipulados.
 *
 * Auth: Script Property `SILAS_TOKEN`, FECHADA por padrão (sem a property,
 * toda requisição é UNAUTHENTICATED). É uma credencial diferente da do admin —
 * `ADMIN_TOKEN` viaja no bundle do front e não serve como segredo de servidor.
 *
 * ESTE ARQUIVO NÃO ESCREVE NADA. Nenhuma função abaixo chama setValue(s),
 * clear, insertRow, appendRow ou altera checkbox/carimbo. Qualquer mudança que
 * introduza escrita aqui quebra a premissa de segurança da integração.
 *
 * Fonte: abas mensais `Escala <Mês>` das 12 planilhas de área
 * (`Data · Voluntário · Período · Função · Telefone · Observações`, PRD Ap. A).
 * A consolidada `Checkin Ser Amor` NÃO é lida: a visão do Silas é a escala
 * provisória das áreas, não a presença do domingo.
 */

// ============================ CONFIG ============================

var SILAS_CONFIG = {
  API_VERSION: '1',
  CLIENT_ID: 'silas-voluntarios',

  // Orçamento de leitura. O plugin trabalha com ~60s; paramos antes e
  // devolvemos status=partial em vez de estourar o timeout do cliente.
  DEADLINE_MS: 45000,

  MAX_BODY_BYTES: 16384,
  LIMITE_PADRAO: 50,
  LIMITE_MAX: 100,
  MAX_CURSOR_CHARS: 512,

  PREFIXO_ABA: 'Escala ',
  MESES_PT: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
             'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],

  // Cabeçalhos da aba mensal (idênticos nas 12 planilhas — confirmado).
  // `Observações` existe na planilha e é deliberadamente NÃO lida.
  COL: {
    DATA: 'Data',
    VOLUNTARIO: 'Voluntário',
    PERIODO: 'Período',
    FUNCAO: 'Função',
    TELEFONE: 'Telefone'
  },

  // Operações autorizadas para a identidade do Silas. Lista fechada.
  OPERACOES: {
    'voluntarios.escalas.pendencias': true,
    'voluntarios.escalas.consultar': true,
    'voluntarios.onboarding.pendencias': true
  },

  // id do contrato → label usado como chave em ADMIN_CONFIG.ORIGEM.
  // A ordem desta lista é a ordem estável de apresentação.
  AREAS: [
    { id: 'transmissao', label: 'Transmissão' },
    { id: 'som',         label: 'Som' },
    { id: 'multimidia',  label: 'Multimídia' },
    { id: 'louvor',      label: 'Louvor' },
    { id: 'logistica',   label: 'Logística' },
    { id: 'foto_video',  label: 'Foto e Vídeo' },
    { id: 'clubinho',    label: 'Clubinho' },
    { id: 'central',     label: 'Central' },
    { id: 'acolhimento', label: 'Acolhimento' },
    { id: 'iluminacao',  label: 'Iluminação' },
    { id: 'ekoe',        label: 'Ekoe' },
    { id: 'producao',    label: 'Produção' }
  ],

  // Regras de cobertura. Só duas exceções; o resto exige Manhã E Noite.
  REGRAS: {
    transmissao: { mode: 'all_of', periods: ['noite'] },
    foto_video:  { mode: 'any_of', periods: ['manha', 'noite'] }
  },
  REGRA_PADRAO: { mode: 'all_of', periods: ['manha', 'noite'] }
};

/** Tokens de erro de fórmula: telefone com erro ≠ telefone ausente. */
var SILAS_ERRO_CELULA = ['#N/A', '#REF!', '#VALUE!', '#DIV/0!', '#NAME?', '#NUM!', '#NULL!', '#ERROR!'];

// ============================ ROTEADOR ============================

/**
 * Entrada única da integração. `rawLength` vem do doPost (tamanho do corpo).
 * Sempre devolve o envelope do contrato — inclusive em erro.
 */
function silasRoute_(body, rawLength) {
  var t0 = Date.now();
  var reqId = silasReqId_(body && body.request_id);
  var op = (body && typeof body.operation === 'string') ? body.operation : '';

  // 1) Formato e tamanho, antes de abrir qualquer planilha.
  if (rawLength && rawLength > SILAS_CONFIG.MAX_BODY_BYTES) {
    return silasErr_(reqId, op, 'INVALID_ARGUMENT', 'Requisição acima do limite aceito.', false);
  }
  if (body && body.action !== undefined) {
    // Corpo híbrido: tentativa de alcançar o roteador legado (de escrita).
    return silasErr_(reqId, op, 'INVALID_ARGUMENT', 'Requisição ambígua.', false);
  }
  if (String(body.api_version || '') !== SILAS_CONFIG.API_VERSION) {
    return silasErr_(reqId, op, 'UNSUPPORTED_VERSION', 'Versão de API não suportada.', false);
  }

  // 2) Autenticar a credencial e derivar a identidade (o campo `client` é
  //    informativo: não concede nada).
  if (!silasAutenticado_(body)) {
    return silasErr_(reqId, op, 'UNAUTHENTICATED', 'Credencial inválida.', false);
  }

  // 3) Operação na allowlist da identidade.
  if (!SILAS_CONFIG.OPERACOES[op]) {
    return silasErr_(reqId, op, 'FORBIDDEN_OPERATION', 'Operação não disponível.', false);
  }

  // 4) Parâmetros e despacho fixo.
  try {
    var params = (body.params === undefined || body.params === null) ? {} : body.params;
    if (typeof params !== 'object' || params instanceof Array) {
      return silasErr_(reqId, op, 'INVALID_ARGUMENT', 'Parâmetros inválidos.', false);
    }

    if (op === 'voluntarios.onboarding.pendencias') {
      // Fora do escopo desta entrega. Nunca devolver lista vazia como se
      // fosse "nenhuma pendência".
      return silasErr_(reqId, op, 'NOTION_NOT_CONFIGURED',
        'O acompanhamento de onboarding ainda não está disponível.', false);
    }

    var v = silasValidarEscala_(params, op);
    if (v.error) return silasErr_(reqId, op, v.error.code, v.error.message, false);
    return silasEscalas_(reqId, op, v.params, t0);
  } catch (ex) {
    // Mensagem genérica: exceção crua pode carregar ID de planilha ou dado pessoal.
    return silasErr_(reqId, op, 'INTERNAL_ERROR', 'Não foi possível concluir a consulta.', true);
  }
}

/** Comparação de token sem atalho de curto-circuito por caractere. */
function silasAutenticado_(body) {
  var esperado = PropertiesService.getScriptProperties().getProperty('SILAS_TOKEN');
  if (!esperado) return false; // falha FECHADA (≠ requireAdmin_ do Admin.gs)
  var got = (body && body.auth && body.auth.token) ? String(body.auth.token) : '';
  if (got.length !== esperado.length) return false;
  var diff = 0;
  for (var i = 0; i < got.length; i++) diff |= (got.charCodeAt(i) ^ esperado.charCodeAt(i));
  return diff === 0;
}

/** Request ID é ecoado em log/resposta: sanear antes de confiar. */
function silasReqId_(raw) {
  var s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(s)) return null;
  return s;
}

// ======================= VALIDAÇÃO DE PARÂMETROS =======================

var SILAS_PARAMS_OK = {
  'voluntarios.escalas.pendencias': ['data', 'area', 'periodo', 'limite', 'cursor'],
  'voluntarios.escalas.consultar':  ['data', 'area', 'periodo', 'limite', 'cursor', 'visao']
};

function silasValidarEscala_(p, op) {
  var permitidos = SILAS_PARAMS_OK[op];
  for (var k in p) {
    if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
    if (permitidos.indexOf(k) < 0) return silasBad_('Parâmetro não reconhecido.');
  }

  var out = { data: null, area: null, periodo: null, limite: SILAS_CONFIG.LIMITE_PADRAO, cursor: null, visao: 'resumo' };

  if (p.data !== undefined && p.data !== null) {
    if (typeof p.data !== 'string' || !silasIsoValido_(p.data)) return silasBad_('Data inválida.');
    if (!silasIsoEhDomingo_(p.data)) return silasBad_('A data informada não é um domingo.');
    out.data = p.data;
  } else {
    out.data = silasProximoDomingo_(silasHojeIso_());
  }

  if (p.area !== undefined && p.area !== null) {
    if (typeof p.area !== 'string' || !silasArea_(p.area)) return silasBad_('Área desconhecida.');
    out.area = p.area;
  }

  if (p.periodo !== undefined && p.periodo !== null) {
    if (p.periodo !== 'manha' && p.periodo !== 'noite') return silasBad_('Período inválido.');
    out.periodo = p.periodo;
  }

  if (p.limite !== undefined && p.limite !== null) {
    if (typeof p.limite !== 'number' || p.limite !== Math.floor(p.limite) ||
        p.limite < 1 || p.limite > SILAS_CONFIG.LIMITE_MAX) return silasBad_('Limite inválido.');
    out.limite = p.limite;
  }

  if (p.cursor !== undefined && p.cursor !== null) {
    if (typeof p.cursor !== 'string' || !p.cursor || p.cursor.length > SILAS_CONFIG.MAX_CURSOR_CHARS) {
      return silasBad_('Cursor inválido.');
    }
    out.cursor = p.cursor;
  }

  if (p.visao !== undefined && p.visao !== null) {
    if (p.visao !== 'resumo' && p.visao !== 'completa') return silasBad_('Visão inválida.');
    out.visao = p.visao;
  }

  return { params: out, error: null };
}

function silasBad_(msg) { return { params: null, error: { code: 'INVALID_ARGUMENT', message: msg } }; }

function silasArea_(id) {
  for (var i = 0; i < SILAS_CONFIG.AREAS.length; i++) {
    if (SILAS_CONFIG.AREAS[i].id === id) return SILAS_CONFIG.AREAS[i];
  }
  return null;
}

function silasRegra_(areaId) {
  return SILAS_CONFIG.REGRAS[areaId] || SILAS_CONFIG.REGRA_PADRAO;
}

/** spreadsheetId a partir do cadastro canônico do Admin.gs. */
function silasSpreadsheetId_(area) {
  return (typeof ADMIN_CONFIG !== 'undefined' && ADMIN_CONFIG.ORIGEM) ? ADMIN_CONFIG.ORIGEM[area.label] : null;
}

// ============================ OPERAÇÕES ============================

function silasEscalas_(reqId, op, p, t0) {
  var alvo = p.data;
  var escopo = p.area ? [silasArea_(p.area)] : SILAS_CONFIG.AREAS.slice();
  var lido = silasLerAreas_(escopo, alvo, t0);

  var areas = [];
  var assignments = [];
  var issues = [];
  var resumo = { assignment_count: 0, coverage_issue_count: 0, phone_issue_row_count: 0, invalid_row_count: 0 };

  for (var i = 0; i < lido.areas.length; i++) {
    var a = lido.areas[i];
    var porPeriodo = { manha: 0, noite: 0 };
    for (var j = 0; j < a.assignments.length; j++) porPeriodo[a.assignments[j].period]++;

    var regra = silasRegra_(a.area.id);
    var cobertura;
    if (a.source_status !== 'ok') {
      cobertura = { status: 'unverified', faltas: [] };
    } else {
      cobertura = silasAvaliarCobertura_(regra, porPeriodo);
    }

    areas.push({
      area: a.area.id,
      label: a.area.label,
      coverage_rule: regra,
      coverage_status: cobertura.status,
      assignments_by_period: porPeriodo,
      source_status: a.source_status
    });

    // Cobertura é avaliada ANTES de qualquer filtro de período (doc 1, §4).
    for (var f = 0; f < cobertura.faltas.length; f++) {
      issues.push({
        issue_id: a.area.id + ':SCHEDULE_MISSING:' + cobertura.faltas[f].join('+'),
        type: 'SCHEDULE_MISSING',
        area: a.area.id,
        periods: cobertura.faltas[f],
        volunteer_name: null,
        source_ref: { sheet: a.sheet_name, row: null },
        _rank: 0, _row: 0
      });
      resumo.coverage_issue_count++;
    }

    for (var t = 0; t < a.phoneIssues.length; t++) {
      var pi = a.phoneIssues[t];
      issues.push({
        issue_id: a.area.id + ':' + pi.type + ':' + pi.row,
        type: pi.type,
        area: a.area.id,
        periods: pi.periods,
        volunteer_name: pi.volunteer_name,
        source_ref: { sheet: a.sheet_name, row: pi.row },
        _rank: pi.type === 'PHONE_MISSING' ? 1 : 2, _row: pi.row
      });
      resumo.phone_issue_row_count++;
    }

    for (var iv = 0; iv < a.invalidRows.length; iv++) {
      var ir = a.invalidRows[iv];
      issues.push({
        issue_id: a.area.id + ':ROW_INVALID:' + ir.row,
        type: 'ROW_INVALID',
        area: a.area.id,
        periods: [],
        volunteer_name: ir.volunteer_name,
        source_ref: { sheet: a.sheet_name, row: ir.row },
        _rank: 3, _row: ir.row
      });
      resumo.invalid_row_count++;
    }

    for (var k = 0; k < a.assignments.length; k++) {
      resumo.assignment_count++;
      assignments.push(a.assignments[k]);
    }
  }

  // Filtro de período: apresentação apenas. As contagens de cobertura acima
  // já foram fechadas com todos os períodos exigidos pela regra da área.
  var itensBrutos;
  if (op === 'voluntarios.escalas.pendencias') {
    itensBrutos = silasOrdenarIssues_(issues, escopo);
    if (p.periodo) {
      itensBrutos = itensBrutos.filter(function (it) {
        return it.periods.length === 0 || it.periods.indexOf(p.periodo) >= 0;
      });
    }
    itensBrutos = itensBrutos.map(silasLimparIssue_);
  } else if (p.visao === 'completa') {
    itensBrutos = assignments.filter(function (x) { return !p.periodo || x.period === p.periodo; });
  } else {
    itensBrutos = [];
  }

  var temPendencia = (resumo.coverage_issue_count + resumo.phone_issue_row_count + resumo.invalid_row_count) > 0;
  var readComplete = lido.read_complete;
  var conclusion = temPendencia ? 'pending' : (readComplete ? 'clear' : 'inconclusive');
  var allClear = (!temPendencia && readComplete);

  var pag = null;
  if (op === 'voluntarios.escalas.pendencias' || p.visao === 'completa') {
    var fatia = silasPaginar_(itensBrutos, p, op, alvo);
    if (fatia.error) return silasErr_(reqId, op, fatia.error, 'A listagem mudou; recomece a consulta.', false);
    pag = fatia.pagination;
    itensBrutos = fatia.items;
  }

  return {
    api_version: SILAS_CONFIG.API_VERSION,
    request_id: reqId,
    operation: op,
    ok: true,
    status: readComplete ? 'complete' : 'partial',
    data: {
      target_date: alvo,
      provisional: true,
      scope: { areas: escopo.map(function (a) { return a.id; }), periodo: p.periodo },
      conclusion: conclusion,
      summary: resumo,
      areas: areas,
      items: itensBrutos
    },
    meta: {
      timezone: CONFIG.TZ,
      read_started_at: lido.read_started_at,
      read_finished_at: silasAgoraIso_(),
      source_count: escopo.length,
      successful_source_count: lido.successful_source_count,
      unverified_sources: lido.unverified_sources,
      read_complete: readComplete,
      all_clear_allowed: allClear,
      warnings: lido.warnings
    },
    pagination: pag,
    error: null
  };
}

function silasLimparIssue_(it) {
  return {
    issue_id: it.issue_id, type: it.type, area: it.area, periods: it.periods,
    volunteer_name: it.volunteer_name, source_ref: it.source_ref
  };
}

/** Ordem estável: área (ordem do cadastro) → tipo → linha. */
function silasOrdenarIssues_(issues, escopo) {
  var pos = {};
  for (var i = 0; i < escopo.length; i++) pos[escopo[i].id] = i;
  return issues.slice().sort(function (a, b) {
    if (pos[a.area] !== pos[b.area]) return pos[a.area] - pos[b.area];
    if (a._rank !== b._rank) return a._rank - b._rank;
    return a._row - b._row;
  });
}

// ============================ LEITURA ============================

/**
 * Lê as áreas do escopo respeitando o orçamento de tempo. Falha de uma área
 * não apaga as outras: vira fonte não verificada.
 */
function silasLerAreas_(escopo, alvoIso, t0) {
  var out = {
    read_started_at: silasAgoraIso_(),
    areas: [], unverified_sources: [], warnings: [],
    successful_source_count: 0, read_complete: true
  };

  for (var i = 0; i < escopo.length; i++) {
    var area = escopo[i];

    if (Date.now() - t0 > SILAS_CONFIG.DEADLINE_MS) {
      out.read_complete = false;
      out.unverified_sources.push({ area: area.id, code: 'UPSTREAM_TIMEOUT' });
      out.areas.push(silasAreaVazia_(area, alvoIso, 'timeout'));
      continue;
    }

    var r = silasLerArea_(area, alvoIso);
    out.areas.push(r);
    if (r.source_status === 'ok') {
      out.successful_source_count++;
      for (var w = 0; w < r.warnings.length; w++) out.warnings.push(r.warnings[w]);
    } else {
      out.read_complete = false;
      out.unverified_sources.push({
        area: area.id,
        code: r.source_status === 'missing_month_sheet' ? 'MONTH_SHEET_NOT_FOUND' : 'SOURCE_UNAVAILABLE'
      });
    }
  }
  return out;
}

function silasAreaVazia_(area, alvoIso, status) {
  return {
    area: area, sheet_name: silasNomeAba_(alvoIso), source_status: status,
    assignments: [], phoneIssues: [], invalidRows: [], warnings: []
  };
}

function silasLerArea_(area, alvoIso) {
  var nomeAba = silasNomeAba_(alvoIso);
  var id = silasSpreadsheetId_(area);
  if (!id) return silasAreaVazia_(area, alvoIso, 'unavailable');

  try {
    var sh = SpreadsheetApp.openById(id).getSheetByName(nomeAba);
    if (!sh) return silasAreaVazia_(area, alvoIso, 'missing_month_sheet');

    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return silasAreaVazia_(area, alvoIso, 'ok');

    var rng = sh.getRange(1, 1, lastRow, lastCol);
    // Dois passes do MESMO range: valores (datas como Date) e valores exibidos
    // (fórmula de telefone que devolve vazio ou #N/A só aparece aqui).
    var valores = rng.getValues();
    var exibidos = rng.getDisplayValues();
    return silasNormalizar_(area, alvoIso, nomeAba, valores, exibidos);
  } catch (ex) {
    return silasAreaVazia_(area, alvoIso, 'unavailable');
  }
}

/**
 * Função PURA (matriz → resultado). É o alvo dos testes: em produção não há
 * planilha de homologação, então a regressão de S4/S5 roda sobre matrizes
 * sintéticas, sem tocar em dado real.
 */
function silasNormalizar_(area, alvoIso, nomeAba, valores, exibidos) {
  var res = { area: area, sheet_name: nomeAba, source_status: 'ok',
              assignments: [], phoneIssues: [], invalidRows: [], warnings: [] };

  var headers = valores[0].map(function (h) { return String(h).trim(); });
  var idx = {};
  for (var h = 0; h < headers.length; h++) idx[headers[h]] = h;

  var cData = idx[SILAS_CONFIG.COL.DATA];
  var cNome = idx[SILAS_CONFIG.COL.VOLUNTARIO];
  var cPer  = idx[SILAS_CONFIG.COL.PERIODO];
  var cFun  = idx[SILAS_CONFIG.COL.FUNCAO];
  var cTel  = idx[SILAS_CONFIG.COL.TELEFONE];
  if (cData === undefined || cNome === undefined || cPer === undefined) {
    res.source_status = 'unavailable';
    return res;
  }

  for (var r = 1; r < valores.length; r++) {
    var linha = r + 1; // 1-based, como a planilha mostra
    var nome = String(valores[r][cNome] === null || valores[r][cNome] === undefined ? '' : valores[r][cNome]).trim();
    var dataIso = silasCelulaData_(valores[r][cData]);
    var brutoData = String(valores[r][cData] === null || valores[r][cData] === undefined ? '' : valores[r][cData]).trim();

    // Linha sem pessoa é linha em branco/estrutural: ignorar em silêncio.
    if (!nome) continue;

    // Pessoa escalada sem data interpretável não pode sumir: pode pertencer
    // à consulta e impede conclusão totalmente positiva.
    if (!dataIso) {
      if (brutoData === '') {
        res.invalidRows.push({ row: linha, volunteer_name: nome, reason: 'DATE_MISSING' });
      } else {
        res.invalidRows.push({ row: linha, volunteer_name: nome, reason: 'DATE_UNPARSEABLE' });
      }
      continue;
    }
    if (dataIso !== alvoIso) continue;

    var per = silasPeriodos_(valores[r][cPer]);
    if (per.periods.length === 0) {
      res.invalidRows.push({ row: linha, volunteer_name: nome, reason: 'PERIOD_UNPARSEABLE' });
      continue;
    }
    if (per.unknown.length) {
      res.warnings.push({ code: 'PERIOD_PARTIALLY_UNKNOWN', area: area.id, sheet: nomeAba, row: linha });
    }

    var tel = (cTel === undefined) ? '' : String(exibidos[r][cTel] === undefined ? '' : exibidos[r][cTel]).trim();
    var telStatus = silasStatusTelefone_(tel);
    if (telStatus !== 'present') {
      // Uma linha com dois períodos conta UMA vez como linha com problema.
      res.phoneIssues.push({
        row: linha,
        type: telStatus === 'missing' ? 'PHONE_MISSING' : 'PHONE_ERROR',
        periods: per.periods.slice(),
        volunteer_name: nome
      });
    }

    var funcao = (cFun === undefined) ? '' : String(valores[r][cFun] === null || valores[r][cFun] === undefined ? '' : valores[r][cFun]).trim();
    for (var q = 0; q < per.periods.length; q++) {
      res.assignments.push({
        assignment_ref: area.id + ':' + nomeAba + ':' + linha + ':' + per.periods[q],
        area: area.id,
        date: dataIso,
        period: per.periods[q],
        volunteer_name: nome,
        'function': funcao || null,
        phone_status: telStatus,
        source_ref: { sheet: nomeAba, row: linha }
      });
    }
  }
  return res;
}

/** all_of: uma falta por período vazio. any_of: no máximo UMA falta no grupo. */
function silasAvaliarCobertura_(regra, porPeriodo) {
  var faltas = [];
  if (regra.mode === 'any_of') {
    var algum = false;
    for (var i = 0; i < regra.periods.length; i++) if (porPeriodo[regra.periods[i]] > 0) algum = true;
    if (!algum) faltas.push(regra.periods.slice());
  } else {
    for (var j = 0; j < regra.periods.length; j++) {
      if (!(porPeriodo[regra.periods[j]] > 0)) faltas.push([regra.periods[j]]);
    }
  }
  return { status: faltas.length ? 'pending' : 'ok', faltas: faltas };
}

// ======================= NORMALIZAÇÃO DE CÉLULAS =======================

function silasCelulaData_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'yyyy-MM-dd');
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) return null;
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return silasIsoValido_(m[3] + '-' + m[2] + '-' + m[1]) ? (m[3] + '-' + m[2] + '-' + m[1]) : null;
  if (silasIsoValido_(s)) return s;
  return null;
}

/**
 * `Manhã, Noite` → ['manha','noite']. Só aliases deliberados; texto
 * desconhecido vira aviso, nunca classificação por adivinhação.
 */
function silasPeriodos_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  var out = { periods: [], unknown: [] };
  if (!s) return out;
  var partes = s.split(/[,;\/+]|\se\s/);
  for (var i = 0; i < partes.length; i++) {
    var p = silasDeburr_(partes[i]).trim();
    if (!p) continue;
    if (p === 'manha' || p === 'manha ') {
      if (out.periods.indexOf('manha') < 0) out.periods.push('manha');
    } else if (p === 'noite') {
      if (out.periods.indexOf('noite') < 0) out.periods.push('noite');
    } else {
      out.unknown.push(p);
    }
  }
  return out;
}

function silasStatusTelefone_(exibido) {
  if (!exibido) return 'missing';
  var up = exibido.toUpperCase();
  for (var i = 0; i < SILAS_ERRO_CELULA.length; i++) {
    if (up.indexOf(SILAS_ERRO_CELULA[i]) === 0) return 'error';
  }
  return 'present';
}

function silasDeburr_(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// ============================ DATAS ============================

function silasHojeIso_() {
  return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
}

function silasAgoraIso_() {
  return Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function silasIsoValido_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return false;
  var y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  var dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Datas civis em UTC: aritmética de dia sem interferência do fuso do projeto. */
function silasIsoParaUtc_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

function silasUtcParaIso_(d) {
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

function silasIsoEhDomingo_(iso) {
  return silasIsoParaUtc_(iso).getUTCDay() === 0;
}

/** Primeiro domingo ESTRITAMENTE posterior a `hojeIso` (hoje domingo → +7). */
function silasProximoDomingo_(hojeIso) {
  var d = silasIsoParaUtc_(hojeIso);
  var dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? 7 : 7 - dow));
  return silasUtcParaIso_(d);
}

/** Aba pelo mês da DATA-ALVO, não pelo relógio de execução. */
function silasNomeAba_(iso) {
  return SILAS_CONFIG.PREFIXO_ABA + SILAS_CONFIG.MESES_PT[+iso.substring(5, 7) - 1];
}

// ============================ PAGINAÇÃO ============================

/**
 * Cursor opaco = base64({o: operação, s: impressão do escopo, i: offset}).
 * Sem snapshot e sem banco: se a impressão mudar, é STALE_CURSOR.
 */
function silasPaginar_(items, p, op, alvo) {
  var imp = silasImpressao_(op, p, alvo, items.length);
  var offset = 0;

  if (p.cursor) {
    var c = silasDecodificarCursor_(p.cursor);
    if (!c || c.o !== op || c.s !== imp) return { error: 'STALE_CURSOR' };
    offset = c.i;
    if (offset < 0 || offset > items.length) return { error: 'STALE_CURSOR' };
  }

  var fatia = items.slice(offset, offset + p.limite);
  var fim = offset + fatia.length;
  var temMais = fim < items.length;

  return {
    error: null,
    items: fatia,
    pagination: {
      limit: p.limite,
      returned: fatia.length,
      total: items.length,
      has_more: temMais,
      next_cursor: temMais ? silasCodificarCursor_({ o: op, s: imp, i: fim }) : null
    }
  };
}

function silasImpressao_(op, p, alvo, total) {
  var base = [op, alvo, p.area || '*', p.periodo || '*', p.visao || '*', String(total)].join('|');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, base, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < 8; i++) {
    var b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

function silasCodificarCursor_(o) {
  return Utilities.base64EncodeWebSafe(JSON.stringify(o));
}

function silasDecodificarCursor_(s) {
  try {
    var txt = Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString();
    var o = JSON.parse(txt);
    if (!o || typeof o.o !== 'string' || typeof o.s !== 'string' || typeof o.i !== 'number') return null;
    return o;
  } catch (ex) { return null; }
}

// ============================ ENVELOPE DE ERRO ============================

function silasErr_(reqId, op, code, message, retryable) {
  return {
    api_version: SILAS_CONFIG.API_VERSION,
    request_id: reqId,
    operation: op || null,
    ok: false,
    status: 'error',
    data: null,
    meta: {
      timezone: CONFIG.TZ,
      read_complete: false,
      all_clear_allowed: false
    },
    pagination: null,
    error: { code: code, message: message, retryable: !!retryable }
  };
}
