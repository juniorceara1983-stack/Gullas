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

function getSheet(name, headers) {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers && headers.length) {
      const r = sh.getRange(1, 1, 1, headers.length);
      r.setValues([headers]);
      r.setFontWeight('bold').setBackground('#f59e0b').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  }
  return sh;
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
  const action = (e.parameter && e.parameter.action) || 'balance';
  let result;
  try {
    switch (action) {
      case 'catalog': result = actionGetCatalog();                               break;
      case 'balance': result = actionGetBalance(e.parameter.date);               break;
      case 'dispatch': result = actionGetDispatch(e.parameter.date);             break;
      case 'history': result = actionGetHistory(e.parameter.from, e.parameter.to); break;
      default:        result = { error: 'acao_desconhecida' };
    }
  } catch (ex) {
    result = { error: ex.toString() };
  }
  return jsonOut(result);
}

function doPost(e) {
  let result = { ok: true };
  try {
    const d = JSON.parse(e.postData.contents);
    switch (d.action) {
      case 'sale':        result = actionSale(d);        break;
      case 'sobra':       result = actionSobra(d);       break;
      case 'setDispatch': result = actionSetDispatch(d); break;
      case 'addItem':     result = actionAddItem(d);     break;
      case 'updateItem':  result = actionUpdateItem(d);  break;
      case 'removeItem':  result = actionRemoveItem(d);  break;
      case 'fechar':      result = actionFechar(d);      break;
      default:            result = { error: 'acao_desconhecida' };
    }
  } catch (ex) {
    result = { error: ex.toString() };
  }
  return jsonOut(result);
}

// ── Catálogo ───────────────────────────────────────────────────

const CAT_HEADERS = ['id', 'nome', 'preco', 'ativo'];
const DEFAULTS    = [
  'Coxinha', 'Empada', 'Pastel', 'Bolo', 'Torta',
  'Refrigerante', 'Suco', 'Açaí',
  'Massa Quente', 'Massa Fria', 'Massa Forno'
];

function actionGetCatalog() {
  const sh   = getSheet('Catalogo', CAT_HEADERS);
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
  const sh   = getSheet('Catalogo', CAT_HEADERS);
  const rows = sheetRows(sh);
  const newId = rows.length
    ? Math.max(...rows.map(r => parseInt(r[0]) || 0)) + 1
    : 1;
  sh.appendRow([newId, d.nome, parseFloat(d.preco) || 0, true]);
  return { ok: true, id: newId };
}

function actionUpdateItem(d) {
  const sh   = getSheet('Catalogo');
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
  const sh   = getSheet('Catalogo');
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

const MOV_HEADERS = [
  'timestamp', 'data', 'tipo', 'produto',
  'qtd', 'preco_unit', 'total', 'funcionario', 'obs', 'imagem_url'
];

function actionSale(d) {
  const sh    = getSheet('Movimentos', MOV_HEADERS);
  const preco = _precoMap();
  const ts    = new Date().toISOString();
  const data  = hoje();
  const img   = d.imagemBase64 ? saveImage(d.imagemBase64, 'venda_' + ts + '.jpg') : '';

  (d.itens || []).forEach(item => {
    const p = preco[item.produto] || 0;
    sh.appendRow([
      ts, data, 'VENDA', item.produto,
      parseInt(item.qtd) || 0, p, p * (parseInt(item.qtd) || 0),
      d.funcionario || '', d.obs || '', img
    ]);
  });
  return { ok: true };
}

function actionSobra(d) {
  const sh   = getSheet('Movimentos', MOV_HEADERS);
  const ts   = new Date().toISOString();
  const data = hoje();
  const img  = d.imagemBase64 ? saveImage(d.imagemBase64, 'sobra_' + ts + '.jpg') : '';

  (d.itens || []).forEach(item => {
    sh.appendRow([
      ts, data, 'SOBRA', item.produto,
      parseInt(item.qtd) || 0, 0, 0,
      d.funcionario || '', d.obs || '', img
    ]);
  });
  return { ok: true };
}

function _precoMap() {
  const rows = sheetRows(getSheet('Catalogo', CAT_HEADERS));
  const map  = {};
  rows.forEach(r => { map[String(r[1])] = parseFloat(r[2]) || 0; });
  return map;
}

// ── Balance / History ──────────────────────────────────────────

function actionGetBalance(date) {
  const data  = date || hoje();
  const rows  = sheetRows(getSheet('Movimentos', MOV_HEADERS));
  const vendas = {};
  const sobras = {};
  const obs    = [];

  rows.forEach(r => {
    if (String(r[1]) !== data) return;
    const tipo  = r[2];
    const prod  = String(r[3]);
    const qtd   = parseInt(r[4])   || 0;
    const preco = parseFloat(r[5]) || 0;

    if (tipo === 'VENDA') {
      if (!vendas[prod]) vendas[prod] = { qtd: 0, preco };
      vendas[prod].qtd += qtd;
      if (!vendas[prod].preco && preco) vendas[prod].preco = preco;
    } else if (tipo === 'SOBRA') {
      if (!sobras[prod]) sobras[prod] = 0;
      sobras[prod] += qtd;
    }

    if (r[8] || r[9]) {
      obs.push({ tipo, produto: prod, obs: r[8], imagem: r[9], funcionario: r[7], ts: r[0] });
    }
  });

  return { data, vendas, sobras, obs };
}

function actionGetHistory(from, to) {
  const rows = sheetRows(getSheet('Movimentos', MOV_HEADERS));
  const dias = {};

  rows.forEach(r => {
    const d = String(r[1]);
    if (from && d < from) return;
    if (to   && d > to)   return;
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

const ENV_HEADERS = ['timestamp', 'data', 'produto', 'qtd', 'funcionario'];

function actionGetDispatch(date) {
  const data = date || hoje();
  const rows = sheetRows(getSheet('Envios', ENV_HEADERS));
  const envios = {};

  rows.forEach(r => {
    if (String(r[1]) !== data) return;
    const prod = String(r[2]);
    const qtd  = parseInt(r[3]) || 0;
    if (!envios[prod]) envios[prod] = 0;
    envios[prod] += qtd;
  });

  return { data, envios };
}

function actionSetDispatch(d) {
  const data = d.data || hoje();
  const itens = Array.isArray(d.itens) ? d.itens : [];
  const sh = getSheet('Envios', ENV_HEADERS);

  const ts = new Date().toISOString();
  const funcionario = d.funcionario || 'ADM';
  const novos = [];
  itens.forEach(item => {
    const qtd = parseInt(item.qtd) || 0;
    if (qtd <= 0) return;
    novos.push([ts, data, String(item.produto || ''), qtd, funcionario]);
  });
  if (novos.length) {
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, novos.length, ENV_HEADERS.length).setValues(novos);
  }

  return { ok: true, data, itensRegistrados: novos.length };
}

// ── Fechar Caixa ───────────────────────────────────────────────

function actionFechar(d) {
  const sh      = getSheet('Fechamentos', ['timestamp', 'data', 'funcionario', 'total_venda']);
  const balance = actionGetBalance(null);
  let total = 0;
  Object.values(balance.vendas).forEach(v => { total += v.qtd * v.preco; });

  sh.appendRow([new Date().toISOString(), hoje(), d.funcionario || 'ADM', total]);
  return { ok: true, total };
}
