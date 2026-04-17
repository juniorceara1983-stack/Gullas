// ================================================================
// Gullas – Backend Google Apps Script
// ================================================================
// INSTALAÇÃO:
//   1. Abra a planilha Google Sheets vinculada a este sistema
//   2. Menu: Extensões > Apps Script
//   3. Cole todo este código e salve (Ctrl+S)
//   4. Publicar > Implantar como aplicativo da Web
//      – Executar como: Eu (sua conta)
//      – Quem tem acesso: Qualquer pessoa (inclusive anônimos)
//   5. Copie a URL gerada e cole em SCRIPT_URL nos arquivos HTML
// ================================================================

const TZ = Session.getScriptTimeZone();
// Preencha com o ID da planilha quando o script for implantado como projeto standalone.
// Em script vinculado à planilha, pode deixar vazio para usar getActiveSpreadsheet().
const SPREADSHEET_ID = '1Ost4-uHKE7qGh_bKarClUcaSvwUG2nRevORp9FO2rsw';

// Nomes canônicos das abas da planilha. Qualquer variação (acento, caixa,
// espaços) é detectada por normalização e reaproveitada/renomeada para estes.
const SHEET_CATALOGO     = 'Catalogo';
const SHEET_MOVIMENTOS   = 'Movimentos';
const SHEET_ENVIOS       = 'Envios';
const SHEET_FECHAMENTOS  = 'Fechamentos';

const CAT_HEADERS = ['id', 'nome', 'preco', 'ativo'];
const MOV_HEADERS = [
  'timestamp', 'data', 'tipo', 'produto',
  'qtd', 'preco_unit', 'total', 'funcionario', 'obs', 'imagem_url', 'loja'
];
const ENV_HEADERS = ['timestamp', 'data', 'produto', 'qtd', 'funcionario', 'loja'];
const FECH_HEADERS = [
  'timestamp', 'data', 'funcionario', 'total_venda',
  'itens_vendidos', 'total_sobras', 'obs_count', 'detalhes_json', 'loja'
];
const LOJA_GERAL = 'GERAL';
const LOJA_PS = 'LOJA PS';
const LOJA_IANDE = 'LOJA IANDE';

// ── Helpers ────────────────────────────────────────────────────

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      const active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) return active;
      throw new Error('planilha_inacessivel: verifique SPREADSHEET_ID e permissões');
    }
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('planilha_nao_configurada: defina SPREADSHEET_ID ou vincule o script à planilha');
}

function hoje() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function agora() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

function pad2(n) {
  const v = parseInt(n, 10);
  if (Number.isNaN(v) || v < 0) return '00';
  return v < 10 ? '0' + v : String(v);
}

function hms(h, m, s) {
  return pad2(h || 0) + ':' + pad2(m || 0) + ':' + pad2(s || 0);
}

function isValidYMD(y, m, d) {
  const yy = parseInt(y, 10);
  const mm = parseInt(m, 10);
  const dd = parseInt(d, 10);
  const invalidNumbers = Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd);
  const invalidYear = yy < 0;
  const invalidMonth = mm < 1 || mm > 12;
  const invalidDay = dd < 1 || dd > 31;
  if (invalidNumbers || invalidYear || invalidMonth || invalidDay) return false;
  const dt = new Date(yy, mm - 1, dd);
  return dt.getFullYear() === yy && (dt.getMonth() + 1) === mm && dt.getDate() === dd;
}

function normalizaDataTexto(s) {
  const txt = String(s || '').trim();
  if (!txt) return '';

  let m = txt.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (m && isValidYMD(m[1], m[2], m[3])) {
    return m[1] + '-' + m[2] + '-' + m[3];
  }

  m = txt.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:[T\s].*)?$/);
  if (m && isValidYMD(m[1], m[2], m[3])) {
    return m[1] + '-' + m[2] + '-' + m[3];
  }

  m = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[T\s].*)?$/);
  if (m && isValidYMD(m[3], m[2], m[1])) {
    return m[3] + '-' + m[2] + '-' + m[1];
  }

  m = txt.match(/^(\d{2})-(\d{2})-(\d{4})(?:[T\s].*)?$/);
  if (m && isValidYMD(m[3], m[2], m[1])) {
    return m[3] + '-' + m[2] + '-' + m[1];
  }

  return '';
}

function normalizaTimestampTexto(s) {
  const txt = String(s || '').trim();
  if (!txt) return '';

  let m = txt.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m && isValidYMD(m[1], m[2], m[3])) {
    return m[1] + '-' + m[2] + '-' + m[3] + ' ' + hms(m[4], m[5], m[6]);
  }

  m = txt.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m && isValidYMD(m[1], m[2], m[3])) {
    return m[1] + '-' + m[2] + '-' + m[3] + ' ' + hms(m[4], m[5], m[6]);
  }

  m = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m && isValidYMD(m[3], m[2], m[1])) {
    return m[3] + '-' + m[2] + '-' + m[1] + ' ' + hms(m[4], m[5], m[6]);
  }

  m = txt.match(/^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m && isValidYMD(m[3], m[2], m[1])) {
    return m[3] + '-' + m[2] + '-' + m[1] + ' ' + hms(m[4], m[5], m[6]);
  }

  return '';
}

// Normaliza entradas de data para yyyy-MM-dd.
// Se a entrada for vazia ou inválida, faz fallback silencioso para hoje().
// Não lança erro para preservar a gravação dos lançamentos.
function normalizaDataISO(value) {
  if (value === null || value === undefined || value === '') return hoje();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return hoje();
    return Utilities.formatDate(value, TZ, 'yyyy-MM-dd');
  }
  const s = String(value).trim();
  if (!s) return hoje();
  const texto = normalizaDataTexto(s);
  if (texto) return texto;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return hoje();
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

// Converte o valor de uma célula (Date ou string) para yyyy-MM-dd.
// Diferente de normalizaDataISO(), retorna '' para valores vazios em vez de
// fazer fallback para hoje(), permitindo filtros exatos por data.
function dataCelula(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, TZ, 'yyyy-MM-dd');
  }
  const s = String(value).trim();
  if (!s) return '';
  const texto = normalizaDataTexto(s);
  if (texto) return texto;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

// Converte o valor de uma célula (Date ou string) para 'yyyy-MM-dd HH:mm:ss'.
// Evita que Date objects sejam exibidos no formato verboso padrão do JS.
function tsCelula(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, TZ, 'yyyy-MM-dd HH:mm:ss');
  }
  const s = String(value).trim();
  if (!s) return '';
  const texto = normalizaTimestampTexto(s);
  if (texto) return texto;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm:ss');
  }
  return s;
}

function stampArquivo() {
  return Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss');
}

function normalizaLoja(value) {
  const s = String(value || '')
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (!s || s === 'GERAL' || s === 'TODAS' || s === 'TODOS' || s === 'ALL') return LOJA_GERAL;
  if (s === 'PS' || s === 'LOJA PS' || s === 'LOJAPS') return LOJA_PS;
  if (s === 'IANDE' || s === 'LOJA IANDE' || s === 'LOJAIANDE') return LOJA_IANDE;
  return LOJA_GERAL;
}

function incluiLoja(valorLinha, lojaFiltro) {
  const filtro = normalizaLoja(lojaFiltro);
  if (filtro === LOJA_GERAL) return true;
  return normalizaLoja(valorLinha) === filtro;
}

function getSheet(name, headers) {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    // Tolerância a variações: tentar casar por nome normalizado antes de criar
    // uma aba nova. Isso evita duplicatas quando alguém renomeia a aba para
    // "Catálogo", "catalogo ", "CATALOGO" etc.
    const target = normalizeSheetName(name);
    const all = ss.getSheets();
    for (let i = 0; i < all.length; i++) {
      if (normalizeSheetName(all[i].getName()) === target) {
        sh = all[i];
        if (sh.getName() !== name) {
          try { sh.setName(name); } catch (e) { /* outra aba já usa o nome canônico */ }
        }
        break;
      }
    }
    if (!sh) sh = ss.insertSheet(name);
  }
  ensureHeaderRow(sh, headers);
  return sh;
}

function normalizeSheetName(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

function ensureHeaderRow(sh, headers) {
  if (!headers || !headers.length) return;
  const cur = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  const mismatch = headers.some((h, i) => String(cur[i] || '') !== String(h));
  if (mismatch) {
    const r = sh.getRange(1, 1, 1, headers.length);
    r.setValues([headers]);
    r.setFontWeight('bold').setBackground('#f59e0b').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }

  // Força formato de texto nas colunas de timestamp/data para impedir que o
  // Google Sheets coerça strings ISO em objetos Date (o que quebra os filtros
  // que comparam por yyyy-MM-dd ao ler via getValues()).
  try {
    const maxRows = Math.max(sh.getMaxRows(), 2);
    headers.forEach((h, i) => {
      const name = String(h || '').toLowerCase();
      if (name === 'timestamp' || name === 'data') {
        sh.getRange(2, i + 1, maxRows - 1, 1).setNumberFormat('@');
      }
    });
  } catch (e) { /* formatação é best-effort */ }
}

function ensureSheetStructure() {
  getSheet(SHEET_CATALOGO, CAT_HEADERS);
  getSheet(SHEET_MOVIMENTOS, MOV_HEADERS);
  getSheet(SHEET_ENVIOS, ENV_HEADERS);
  getSheet(SHEET_FECHAMENTOS, FECH_HEADERS);
}

function sheetRows(sh) {
  const lr = sh.getLastRow();
  const lc = sh.getLastColumn();
  if (lr < 2 || lc < 1) return [];
  return sh.getRange(2, 1, lr - 1, lc).getValues();
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Drive (imagens) ────────────────────────────────────────────

function getImgFolder() {
  const name = 'Gullas-Imagens';
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5 MB limit

function saveImage(base64, filename) {
  try {
    const clean = base64.replace(/^data:image\/\w+;base64,/, '');
    const bytes = Utilities.base64Decode(clean);
    if (bytes.length > MAX_IMG_BYTES) { return ''; }
    const blob  = Utilities.newBlob(bytes, 'image/jpeg', filename);
    const file  = getImgFolder().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/uc?id=' + file.getId();
  } catch (e) {
    return '';
  }
}

// ── HTTP entry-points ──────────────────────────────────────────

function doGet(e) {
  ensureSheetStructure();
  const action = (e.parameter && e.parameter.action) || 'balance';
  let result;
  try {
    switch (action) {
      case 'catalog': result = actionGetCatalog();                               break;
      case 'balance': result = actionGetBalance(e.parameter.date, e.parameter.loja);               break;
      case 'dispatch': result = actionGetDispatch(e.parameter.date, e.parameter.loja);             break;
      case 'report':  result = actionGetDayReport(e.parameter.date, e.parameter.loja);             break;
      case 'history': result = actionGetHistory(e.parameter.from, e.parameter.to, e.parameter.loja); break;
      default:        result = { error: 'acao_desconhecida' };
    }
  } catch (ex) {
    result = { error: ex.toString() };
  }
  return jsonOut(result);
}

function doPost(e) {
  ensureSheetStructure();
  let result = { ok: true };
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ error: 'dados_ausentes: corpo da requisição vazio' });
    }
    const d = JSON.parse(e.postData.contents);
    switch (d.action) {
      case 'sale':        result = actionSale(d);        break;
      case 'sobra':       result = actionSobra(d);       break;
      case 'setDispatch': result = actionSetDispatch(d); break;
      case 'addItem':     result = actionAddItem(d);     break;
      case 'updateItem':  result = actionUpdateItem(d);  break;
      case 'removeItem':  result = actionRemoveItem(d);  break;
      case 'fechar':      result = actionFechar(d);      break;
      case 'reabrir':     result = actionReabrir(d);     break;
      default:            result = { error: 'acao_desconhecida' };
    }
  } catch (ex) {
    result = { error: ex.toString() };
  }
  return jsonOut(result);
}

// ── Catálogo ───────────────────────────────────────────────────

const DEFAULTS    = [
  'Coxinha', 'Empada', 'Pastel', 'Bolo', 'Torta',
  'Refrigerante', 'Suco', 'Açaí',
  'Massa Quente', 'Massa Fria', 'Massa Forno'
];

function actionGetCatalog() {
  const sh   = getSheet(SHEET_CATALOGO, CAT_HEADERS);
  const rows = sheetRows(sh);

  if (rows.length === 0) {
    DEFAULTS.forEach((n, i) => sh.appendRow([i + 1, n, 0, true]));
    return DEFAULTS.map((n, i) => ({ id: i + 1, nome: n, preco: 0 }));
  }

  return rows
    .filter(r => r[3] === true || String(r[3]).toLowerCase() === 'true')
    .map(r => ({ id: r[0], nome: String(r[1]), preco: parseFloat(r[2]) || 0 }));
}

function actionAddItem(d) {
  const sh   = getSheet(SHEET_CATALOGO, CAT_HEADERS);
  const rows = sheetRows(sh);
  const newId = rows.length
    ? Math.max(...rows.map(r => parseInt(r[0]) || 0)) + 1
    : 1;
  sh.appendRow([newId, d.nome, parseFloat(d.preco) || 0, true]);
  return { ok: true, id: newId };
}

function actionUpdateItem(d) {
  const sh   = getSheet(SHEET_CATALOGO, CAT_HEADERS);
  const rows = sheetRows(sh);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(d.id)) {
      if (d.nome  !== undefined) sh.getRange(i + 2, 2).setValue(d.nome);
      if (d.preco !== undefined) sh.getRange(i + 2, 3).setValue(parseFloat(d.preco) || 0);
      return { ok: true };
    }
  }
  return { error: 'item_nao_encontrado' };
}

function actionRemoveItem(d) {
  const sh   = getSheet(SHEET_CATALOGO, CAT_HEADERS);
  const rows = sheetRows(sh);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(d.id)) {
      sh.getRange(i + 2, 4).setValue(false);
      return { ok: true };
    }
  }
  return { error: 'item_nao_encontrado' };
}

// ── Movimentos ─────────────────────────────────────────────────

function actionSale(d) {
  const sh    = getSheet(SHEET_MOVIMENTOS, MOV_HEADERS);
  const preco = _precoMap();
  const ts    = agora();
  const data  = normalizaDataISO(d.data);
  const loja  = normalizaLoja(d && d.loja);
  const img   = d.imagemBase64 ? saveImage(d.imagemBase64, 'venda_' + stampArquivo() + '.jpg') : '';

  (d.itens || []).forEach(item => {
    const p = preco[item.produto] || 0;
    sh.appendRow([
      ts, data, 'VENDA', item.produto,
      parseInt(item.qtd) || 0, p, p * (parseInt(item.qtd) || 0),
      d.funcionario || '', d.obs || '', img, loja
    ]);
  });
  return { ok: true };
}

function actionSobra(d) {
  const sh   = getSheet(SHEET_MOVIMENTOS, MOV_HEADERS);
  const ts   = agora();
  const data = normalizaDataISO(d.data);
  const loja = normalizaLoja(d && d.loja);
  const img  = d.imagemBase64 ? saveImage(d.imagemBase64, 'sobra_' + stampArquivo() + '.jpg') : '';

  (d.itens || []).forEach(item => {
    sh.appendRow([
      ts, data, 'SOBRA', item.produto,
      parseInt(item.qtd) || 0, 0, 0,
      d.funcionario || '', d.obs || '', img, loja
    ]);
  });
  return { ok: true };
}

function _precoMap() {
  const rows = sheetRows(getSheet(SHEET_CATALOGO, CAT_HEADERS));
  const map  = {};
  rows.forEach(r => { map[String(r[1])] = parseFloat(r[2]) || 0; });
  return map;
}

// ── Balance / History ──────────────────────────────────────────

function actionGetBalance(date, loja) {
  const data  = normalizaDataISO(date);
  const filtroLoja = normalizaLoja(loja);
  const rows  = sheetRows(getSheet(SHEET_MOVIMENTOS, MOV_HEADERS));
  const vendas = {};
  const sobras = {};
  const obs    = [];
  const registrosVendas = [];
  const registrosSobras = [];

  rows.forEach(r => {
    if (dataCelula(r[1]) !== data) return;
    if (!incluiLoja(r[10], filtroLoja)) return;
    const tipo  = r[2];
    const prod  = String(r[3]);
    const qtd   = parseInt(r[4])   || 0;
    const preco = parseFloat(r[5]) || 0;
    const total = parseFloat(r[6]) || 0;
    const funcionario = String(r[7] || '');
    const obsTxt = String(r[8] || '');
    const img = String(r[9] || '');
    const lojaLinha = normalizaLoja(r[10]);
    const ts = tsCelula(r[0]);

    if (tipo === 'VENDA') {
      if (!vendas[prod]) vendas[prod] = { qtd: 0, preco };
      vendas[prod].qtd += qtd;
      if (!vendas[prod].preco && preco) vendas[prod].preco = preco;
      registrosVendas.push({ timestamp: ts, produto: prod, qtd, preco, total, funcionario, obs: obsTxt, imagem: img, loja: lojaLinha });
    } else if (tipo === 'SOBRA') {
      if (!sobras[prod]) sobras[prod] = 0;
      sobras[prod] += qtd;
      registrosSobras.push({ timestamp: ts, produto: prod, qtd, funcionario, obs: obsTxt, imagem: img, loja: lojaLinha });
    }

    if (obsTxt || img) {
      obs.push({ tipo, produto: prod, obs: obsTxt, imagem: img, funcionario, ts, loja: lojaLinha });
    }
  });

  return { data, loja: filtroLoja, vendas, sobras, obs, registrosVendas, registrosSobras };
}

function actionGetHistory(from, to, loja) {
  const rows = sheetRows(getSheet(SHEET_MOVIMENTOS, MOV_HEADERS));
  const dias = {};
  const filtroLoja = normalizaLoja(loja);

  rows.forEach(r => {
    const d = dataCelula(r[1]);
    if (from && d < from) return;
    if (to   && d > to)   return;
    if (!d) return;
    if (!incluiLoja(r[10], filtroLoja)) return;
    if (!dias[d]) dias[d] = { vendas: {}, sobras: {} };

    const tipo  = r[2];
    const prod  = String(r[3]);
    const qtd   = parseInt(r[4])   || 0;
    const preco = parseFloat(r[5]) || 0;

    if (tipo === 'VENDA') {
      if (!dias[d].vendas[prod]) dias[d].vendas[prod] = { qtd: 0, preco };
      dias[d].vendas[prod].qtd += qtd;
    } else if (tipo === 'SOBRA') {
      if (!dias[d].sobras[prod]) dias[d].sobras[prod] = 0;
      dias[d].sobras[prod] += qtd;
    }
  });

  return dias;
}

// ── Envios / Estufa ────────────────────────────────────────────

function actionGetDispatch(date, loja) {
  const data = normalizaDataISO(date);
  const filtroLoja = normalizaLoja(loja);
  const rows = sheetRows(getSheet(SHEET_ENVIOS, ENV_HEADERS));
  const envios = {};
  const registros = [];

  rows.forEach(r => {
    if (dataCelula(r[1]) !== data) return;
    if (!incluiLoja(r[5], filtroLoja)) return;
    const prod = String(r[2]);
    const qtd  = parseInt(r[3]) || 0;
    const lojaLinha = normalizaLoja(r[5]);
    if (!envios[prod]) envios[prod] = 0;
    envios[prod] += qtd;
    registros.push({
      timestamp: tsCelula(r[0]),
      produto: prod,
      qtd,
      funcionario: String(r[4] || ''),
      loja: lojaLinha
    });
  });

  return { data, loja: filtroLoja, envios, registros };
}

function actionSetDispatch(d) {
  const data = normalizaDataISO(d.data);
  const loja = normalizaLoja(d && d.loja);
  const itens = Array.isArray(d.itens) ? d.itens : [];
  const sh = getSheet(SHEET_ENVIOS, ENV_HEADERS);

  const ts = agora();
  const funcionario = d.funcionario || 'ADM';
  const novos = [];
  itens.forEach(item => {
    const qtd = parseInt(item.qtd) || 0;
    if (qtd <= 0) return;
    novos.push([ts, data, String(item.produto || ''), qtd, funcionario, loja]);
  });
  if (novos.length) {
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, novos.length, ENV_HEADERS.length).setValues(novos);
  }

  return { ok: true, data };
}

// Verifica se já existe fechamento para a data.
function isFechado(data, loja) {
  const filtroLoja = normalizaLoja(loja);
  const rows = sheetRows(getSheet(SHEET_FECHAMENTOS, FECH_HEADERS));
  for (let i = 0; i < rows.length; i++) {
    if (dataCelula(rows[i][1]) !== data) continue;
    if (filtroLoja === LOJA_GERAL) return true;
    if (normalizaLoja(rows[i][8]) === filtroLoja) return true;
  }
  return false;
}

// Remove todas as linhas de Envios cuja data corresponde à informada.
// Os registros permanecem preservados dentro do snapshot JSON gravado em
// Fechamentos (coluna detalhes_json), então o histórico não é perdido.
function limparEnviosDoDia(data, loja) {
  const filtroLoja = normalizaLoja(loja);
  const sh = getSheet(SHEET_ENVIOS, ENV_HEADERS);
  const lr = sh.getLastRow();
  if (lr < 2) return 0;
  const values = sh.getRange(2, 1, lr - 1, ENV_HEADERS.length).getValues();
  let removed = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (dataCelula(values[i][1]) === data && incluiLoja(values[i][5], filtroLoja)) {
      sh.deleteRow(i + 2);
      removed++;
    }
  }
  return removed;
}

// ── Relatório unificado do dia ─────────────────────────────────

function actionGetDayReport(date, loja) {
  const data = normalizaDataISO(date);
  const filtroLoja = normalizaLoja(loja);
  const balance = actionGetBalance(data, filtroLoja);
  const dispatch = actionGetDispatch(data, filtroLoja);
  const fechado = isFechado(data, filtroLoja);
  return {
    data,
    loja: filtroLoja,
    vendas: balance.vendas || {},
    sobras: balance.sobras || {},
    obs: balance.obs || [],
    registrosVendas: balance.registrosVendas || [],
    registrosSobras: balance.registrosSobras || [],
    envios: dispatch.envios || {},
    registrosEnvios: dispatch.registros || [],
    fechado
  };
}

// ── Fechar Caixa ───────────────────────────────────────────────

function actionFechar(d) {
  const sh      = getSheet(SHEET_FECHAMENTOS, FECH_HEADERS);
  const data    = normalizaDataISO(d && d.data);
  const loja    = normalizaLoja(d && d.loja);
  const balance = actionGetBalance(data, loja);
  const dispatch = actionGetDispatch(data, loja);

  let total = 0;
  let itensVendidos = 0;
  Object.values(balance.vendas).forEach(v => {
    total += v.qtd * v.preco;
    itensVendidos += v.qtd;
  });

  let totalSobras = 0;
  Object.values(balance.sobras).forEach(q => { totalSobras += q; });

  const obsCount = (balance.obs || []).length;
  const detalhes = {
    data,
    loja,
    funcionario: (d && d.funcionario) || 'ADM',
    vendas: balance.vendas || {},
    sobras: balance.sobras || {},
    obs: balance.obs || [],
    registrosVendas: balance.registrosVendas || [],
    registrosSobras: balance.registrosSobras || [],
    envios: dispatch.envios || {},
    envios_registros: dispatch.registros || []
  };

  sh.appendRow([
    agora(),
    data,
    (d && d.funcionario) || 'ADM',
    total,
    itensVendidos,
    totalSobras,
    obsCount,
    JSON.stringify(detalhes),
    loja
  ]);

  // Zera a Estufa do dia: remove linhas de Envios para que o painel volte a
  // zero imediatamente. Os dados permanecem preservados no snapshot JSON
  // gravado acima em Fechamentos.
  limparEnviosDoDia(data, loja);

  return {
    ok: true, data, loja, total,
    itensVendidos, totalSobras, obsCount,
    vendas: balance.vendas,
    sobras: balance.sobras,
    obs: balance.obs,
    envios: dispatch.envios,
    enviosRegistros: dispatch.registros,
    fechado: true
  };
}

// ── Reabrir Caixa ──────────────────────────────────────────────
// Desfaz o fechamento do dia: restaura as linhas de Envios a partir do
// snapshot JSON gravado em Fechamentos e remove a(s) linha(s) de
// Fechamentos para a data. Permite corrigir fechamentos feitos por
// descuido sem iniciar um novo dia. Uso restrito ao painel admin.
function actionReabrir(d) {
  const data = normalizaDataISO(d && d.data);
  const loja = normalizaLoja(d && d.loja);
  const sh   = getSheet(SHEET_FECHAMENTOS, FECH_HEADERS);
  const lr   = sh.getLastRow();
  if (lr < 2) {
    return { error: 'nao_fechado: nenhum fechamento encontrado para ' + data };
  }

  const values = sh.getRange(2, 1, lr - 1, FECH_HEADERS.length).getValues();

  // Localiza o fechamento mais recente para a data (maior índice).
  let targetIdx = -1;
  let targetRow = null;
  for (let i = values.length - 1; i >= 0; i--) {
    if (dataCelula(values[i][1]) !== data) continue;
    if (loja !== LOJA_GERAL && normalizaLoja(values[i][8]) !== loja) continue;
    targetIdx = i;
    targetRow = values[i];
    break;
  }
  if (targetIdx < 0) {
    return { error: 'nao_fechado: nenhum fechamento encontrado para ' + data };
  }

  // Restaura envios a partir do snapshot JSON (coluna detalhes_json).
  let restaurados = 0;
  try {
    let detalhes = {};
    const bruto = String(targetRow[7] || '').trim();
    if (bruto) detalhes = JSON.parse(bruto);
    const registros = Array.isArray(detalhes.envios_registros)
      ? detalhes.envios_registros
      : [];
    limparEnviosDoDia(data, loja);
    if (registros.length) {
      const shEnv = getSheet(SHEET_ENVIOS, ENV_HEADERS);
      const novos = registros.map(reg => ([
        reg && reg.timestamp ? String(reg.timestamp) : agora(),
        data,
        String((reg && reg.produto) || ''),
        parseInt(reg && reg.qtd) || 0,
        String((reg && reg.funcionario) || ''),
        normalizaLoja((reg && reg.loja) || detalhes.loja || loja)
      ])).filter(row => row[2] && row[3] > 0);
      if (novos.length) {
        const startRow = shEnv.getLastRow() + 1;
        shEnv.getRange(startRow, 1, novos.length, ENV_HEADERS.length).setValues(novos);
        restaurados = novos.length;
      }
    }
  } catch (e) {
    // Se o snapshot estiver corrompido, ainda removemos o fechamento para
    // permitir que o admin reabra o dia manualmente.
  }

  // Remove TODAS as linhas de fechamento para a data (garante estado aberto).
  for (let i = values.length - 1; i >= 0; i--) {
    if (dataCelula(values[i][1]) !== data) continue;
    if (loja !== LOJA_GERAL && normalizaLoja(values[i][8]) !== loja) continue;
    sh.deleteRow(i + 2);
  }

  return { ok: true, data, loja, reabertos: restaurados, fechado: false };
}
