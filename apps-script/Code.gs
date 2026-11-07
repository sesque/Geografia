var SPREADSHEET_NAME = 'Geografía – Scores';
var SHEET_NAME = 'Scores';
var SPREADSHEET_KEY = 'SPREADSHEET_ID';
var HEADER = ['id', 'player', 'topic', 'count', 'correct', 'total', 'date', 'answers'];
var MAX_PAYLOAD = 20 * 1024;

function props() {
  return PropertiesService.getScriptProperties();
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  if (action !== 'list') return jsonOutput({ ok: false, error: 'unknown action' });
  try {
    var games = readGames();
    return jsonOutput({ ok: true, games: games });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var contents = e && e.postData ? e.postData.contents : '';
    if (!contents || Utilities.newBlob(contents).getBytes().length > MAX_PAYLOAD) {
      return jsonOutput({ ok: false, error: 'payload missing or too large' });
    }
    var body = JSON.parse(contents);
    var player = body && body.player;
    var game = body && body.game;
    var error = validate(player, game);
    if (error) return jsonOutput({ ok: false, error: error });

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var sheet = getSheet();
      if (findRowById(sheet, game.id) !== -1) return jsonOutput({ ok: true });
      sheet.appendRow([
        game.id,
        player,
        game.topic,
        game.count,
        game.correct,
        game.total,
        game.date,
        JSON.stringify(game.answers)
      ]);
    } finally {
      lock.releaseLock();
    }
    return jsonOutput({ ok: true });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function validate(player, game) {
  if (typeof player !== 'string' || player.length < 1 || player.length > 24 || /^[=+\-@]/.test(player)) return 'invalid player';
  if (!game || typeof game !== 'object') return 'invalid game';
  if (typeof game.id !== 'string' || !game.id || game.id.length > 100) return 'invalid id';
  if (typeof game.topic !== 'string' || !game.topic || game.topic.length > 40) return 'invalid topic';
  if (!isInteger(game.count) || game.count < 0) return 'invalid count';
  if (!isInteger(game.correct) || !isInteger(game.total)) return 'invalid score';
  if (game.correct < 0 || game.total < 0 || game.correct > game.total || game.total > 100) return 'invalid score';
  if (typeof game.date !== 'string' || isNaN(Date.parse(game.date))) return 'invalid date';
  if (!Array.isArray(game.answers) || game.answers.length > 100) return 'invalid answers';
  for (var i = 0; i < game.answers.length; i += 1) {
    var answer = game.answers[i];
    if (!answer || typeof answer !== 'object') return 'invalid answer';
    if (typeof answer.itemKey !== 'string' || !answer.itemKey) return 'invalid answer';
    if (typeof answer.correct !== 'boolean') return 'invalid answer';
  }
  return null;
}

function isInteger(value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
}

function getSpreadsheet() {
  var id = props().getProperty(SPREADSHEET_KEY);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      /* the file was deleted; create a fresh one below */
    }
  }
  var created = SpreadsheetApp.create(SPREADSHEET_NAME);
  props().setProperty(SPREADSHEET_KEY, created.getId());
  return created;
}

function getSheet() {
  var spreadsheet = getSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    var sheets = spreadsheet.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
      sheet = sheets[0].setName(SHEET_NAME);
    } else {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
    }
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.getRange(1, 1, 1, HEADER.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRowById(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i += 1) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function readGames() {
  var sheet = getSheet();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var rows = sheet.getRange(2, 1, last - 1, HEADER.length).getValues();
  var games = [];
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (!row[0]) continue;
    var answers = [];
    try {
      answers = JSON.parse(row[7] || '[]');
    } catch (err) {
      answers = [];
    }
    games.push({
      id: String(row[0]),
      player: String(row[1]),
      topic: String(row[2]),
      count: Number(row[3]),
      correct: Number(row[4]),
      total: Number(row[5]),
      date: row[6] instanceof Date ? row[6].toISOString() : String(row[6]),
      answers: answers
    });
  }
  return games;
}
