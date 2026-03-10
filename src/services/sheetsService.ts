/** Thin wrapper around the Google Sheets API v4, authenticated via a service account. */

import { google } from 'googleapis';

function getAuthClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is not set');

  const creds = JSON.parse(json);
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

/**
 * Fetches a range from a Google Sheet and returns it as a 2D array of strings.
 * Empty cells are returned as empty strings.
 */
export async function getSheetRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values as string[][]) || [];
}
