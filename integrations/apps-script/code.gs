/**
 * South Jersey Blinds - Apps Script Client
 * Thin client that calls the centralized API for all business logic
 */

// Configuration
const API_BASE_URL = 'http://localhost:3000'; // Change to production URL after deployment
const CLIENT_ID = 'south-jersey-blinds';
const SPREADSHEET_ID = '1XD_-IXLyH8ydIfDSYn2IJChsrA0ymmF7yFnPh4DJp4c';

/**
 * Get API secret from Script Properties
 * Set this in: Extensions > Apps Script > Project Settings > Script Properties
 * Key: API_SECRET
 * Value: (the apiSecret from clients/south-jersey-blinds/config.json)
 */
function getApiSecret_() {
  const secret = PropertiesService.getScriptProperties().getProperty('API_SECRET');
  if (!secret) {
    throw new Error('Missing API_SECRET in Script Properties. Please configure it.');
  }
  return secret.trim();
}

/**
 * Call the API with authentication
 */
function callAPI_(endpoint, payload) {
  const url = API_BASE_URL + endpoint;
  const secret = getApiSecret_();

  // Add clientId to payload
  payload.clientId = CLIENT_ID;

  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const bodyText = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error(`API error ${code}: ${bodyText}`);
  }

  return JSON.parse(bodyText);
}

/**
 * Write data to a sheet
 */
function writeToSheet_(sheetName, headers, rows, note) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Add note to cell A1 if provided
  if (note) {
    sheet.getRange('A1').setNote(note);
  }

  // Clear existing data (keep formulas in other columns)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  // Write headers
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  // Write data rows
  if (rows && rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  Logger.log(`Wrote ${rows.length} rows to ${sheetName}`);
}

// ========================================
// Main Functions (called by ChatGPT or manually)
// ========================================

/**
 * Update year-to-date invoices
 */
function run_invoice_update() {
  try {
    Logger.log('Starting invoice update (YTD)...');
    
    const data = callAPI_('/api/sync-invoices', {
      action: 'ytd'
    });

    if (!data.ok) {
      throw new Error(data.message || 'API returned error');
    }

    const note = `Updated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} | Count: ${data.count}`;
    
    writeToSheet_('Raw_YTD', data.headers, data.rows, note);
    
    Logger.log(`✅ Success: ${data.count} invoices updated`);
    return { success: true, count: data.count };
    
  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Update appointments year-to-date
 */
/**
 * Sync appointments year-to-date
 */
function run_appts_update() {
  try {
    Logger.log('Starting appointments update (YTD)...');
    
    const data = callAPI_('/api/sync-appointments', {
      action: 'ytd'
    });

    if (!data.ok) {
      throw new Error(data.message || 'API returned error');
    }

    const note = `Updated: ${new Date().toLocaleString()} | Count: ${data.count}`;
    
    writeToSheet_('Raw_Appts_YTD', data.headers, data.rows, note);
    
    Logger.log(`✅ Success: ${data.count} appointments updated`);
    return { success: true, count: data.count };
    
  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Test with smaller dataset (last 30 days)
 */
function testApptsSync() {
  try {
    Logger.log('Testing with last 30 days of appointments...');
    
    // For appointments, we don't have last7days/last30days actions yet
    // So we'll use 'ytd' but you could add those actions if needed
    const data = callAPI_('/api/sync-appointments', {
      action: 'ytd'
    });

    if (!data.ok) {
      throw new Error(data.message || 'API returned error');
    }

    Logger.log('Data count: ' + data.count);
    
    if (data.count === 0) {
      Logger.log('No appointments returned');
      return { success: true, count: 0 };
    }

    const note = `TEST - YTD Appointments - Updated: ${new Date().toLocaleString()} | Count: ${data.count}`;
    
    writeToSheet_('Test_Appts', data.headers, data.rows, note);
    
    Logger.log(`✅ Success: ${data.count} appointments written to Test_Appts sheet`);
    return { success: true, count: data.count };
    
  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Check API connection and client status
 */
function testConnection() {
  try {
    Logger.log('Testing API connection...');
    
    const data = callAPI_('/api/client-status', {});
    
    Logger.log('✅ Connection successful!');
    Logger.log(`Client: ${data.clientName}`);
    Logger.log(`CRM Type: ${data.crmType}`);
    Logger.log(`Has CRM: ${data.hasCRM}`);
    Logger.log(`Features: ${JSON.stringify(data.features)}`);
    
    return data;
    
  } catch (error) {
    Logger.log(`❌ Connection failed: ${error.message}`);
    throw error;
  }
}

// ========================================
// Web App Endpoints (for ChatGPT integration)
// ========================================

/**
 * Handle POST requests from ChatGPT
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const action = payload.action;

    // Verify secret from ChatGPT matches our expected secret
    const expectedSecret = getApiSecret_();
    const providedSecret = payload.secret || e.parameter?.secret;

    if (providedSecret !== expectedSecret) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    let result;

    switch (action) {
      case 'run_invoice_update':
        result = run_invoice_update();
        break;
      
      case 'run_appts_update':
        result = run_appts_update();
        break;
      
      case 'test_connection':
        result = testConnection();
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, action, result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing in browser)
 */
function doGet(e) {
  const params = e?.parameter || {};
  
  // Simple test endpoint
  if (params.test === '1') {
    try {
      const status = testConnection();
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, status }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: error.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Otherwise, treat as action request
  const fakeEvent = {
    postData: { contents: JSON.stringify({ action: params.action }) },
    parameter: params
  };
  
  return doPost(fakeEvent);
}