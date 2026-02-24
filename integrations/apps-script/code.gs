/**
 * South Jersey Blinds — Apps Script thin client
 * All business logic lives in the API. This file only calls the API and writes to sheets.
 *
 * Setup:
 *   Extensions > Apps Script > Project Settings > Script Properties
 *   Add key: API_SECRET  (value from clients/south-jersey-blinds/config.json → apiSecret)
 */

const API_BASE_URL = 'https://your-api-url.vercel.app'; // Replace with deployed URL
const CLIENT_ID = 'south-jersey-blinds';
const SPREADSHEET_ID = '1XD_-IXLyH8ydIfDSYn2IJChsrA0ymmF7yFnPh4DJp4c';

// ---------------------------
// Core helpers
// ---------------------------

function getApiSecret_() {
  const secret = PropertiesService.getScriptProperties().getProperty('API_SECRET');
  if (!secret) throw new Error('Missing API_SECRET in Script Properties');
  return secret.trim();
}

function callAPI_(endpoint, payload) {
  payload.clientId = CLIENT_ID;
  const response = UrlFetchApp.fetch(API_BASE_URL + endpoint, {
    method: 'post',
    headers: { 'Authorization': `Bearer ${getApiSecret_()}`, 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code < 200 || code >= 300) throw new Error(`API error ${code}: ${body}`);
  return JSON.parse(body);
}

function writeToSheet_(sheetName, headers, rows, note) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  if (note) sheet.getRange('A1').setNote(note);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  if (rows && rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  Logger.log(`Wrote ${rows.length} rows to ${sheetName}`);
}

function syncAndWrite_(endpoint, sheetName, actionPayload) {
  const data = callAPI_(endpoint, actionPayload);
  if (!data.ok) throw new Error(data.message || 'API returned error');
  const note = `Updated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} | Count: ${data.count}`;
  writeToSheet_(sheetName, data.headers, data.rows, note);
  Logger.log(`✅ ${sheetName}: ${data.count} rows`);
  return { success: true, count: data.count };
}

// ---------------------------
// Public sync functions
// ---------------------------

function run_invoice_update() {
  return syncAndWrite_('/api/sync-invoices', 'Raw_YTD', { action: 'ytd' });
}

function run_appts_update() {
  return syncAndWrite_('/api/sync-appointments', 'Raw_Appts_YTD', { action: 'ytd' });
}

function run_payment_type_update() {
  return syncAndWrite_('/api/sync-payment-types', 'payment_type', { action: 'ytd' });
}

function testConnection() {
  const data = callAPI_('/api/client-status', {});
  Logger.log(`Client: ${data.clientName} | CRM: ${data.crmType} | Connected: ${data.ok}`);
  return data;
}

// ---------------------------
// Web app (ChatGPT / external triggers)
// ---------------------------

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const provided = payload.secret || e.parameter?.secret || '';
    if (provided !== getApiSecret_()) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    const action = String(payload.action || e.parameter?.action || '').trim();
    const handlers = {
      run_invoice_update,
      run_appts_update,
      run_payment_type_update,
      test_connection: testConnection,
    };

    if (!handlers[action]) return json_({ ok: false, error: `unknown_action: ${action}` });
    const result = handlers[action]();
    return json_({ ok: true, action, result });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function doGet(e) {
  const params = e?.parameter || {};
  const fakeEvent = {
    postData: { contents: JSON.stringify({ action: params.action, secret: params.secret }) },
    parameter: params,
  };
  return doPost(fakeEvent);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
