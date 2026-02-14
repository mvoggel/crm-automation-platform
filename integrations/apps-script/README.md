# South Jersey Blinds - Apps Script Integration

## Setup Instructions

### 1. Create New Apps Script Project

1. Go to https://script.google.com
2. Click "New Project"
3. Name it: "SJ Blinds - API Client"

### 2. Copy Code

1. Delete the default `Code.gs` content
2. Copy/paste the contents of `Code.gs` from this folder
3. Copy/paste the contents of `appsscript.json` (click the gear icon in Apps Script editor)

### 3. Configure Script Properties

1. In Apps Script editor: **Project Settings** (gear icon)
2. Scroll to **Script Properties**
3. Click **Add script property**
4. Add:
   - **Property:** `API_SECRET`
   - **Value:** (copy from `clients/south-jersey-blinds/config.json` → `apiSecret` field)
5. Click **Save**

### 4. Update API_BASE_URL (After Deployment)

Once your API is deployed to Vercel:

1. In `Code.gs`, change line 8:
```javascript
   const API_BASE_URL = 'https://your-api.vercel.app';
```

### 5. Test Connection

1. In Apps Script editor, select function: `testConnection`
2. Click **Run**
3. Authorize the script when prompted
4. Check **Execution log** - should see "✅ Connection successful!"

### 6. Deploy as Web App (for ChatGPT)

1. Click **Deploy** > **New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone** (ChatGPT needs to call it)
5. Click **Deploy**
6. Copy the **Web App URL** - you'll use this in ChatGPT

## Functions Available

### Manual Functions (run from Apps Script editor)
- `run_invoice_update()` - Updates Raw_YTD sheet with latest invoices
- `run_appts_update()` - Updates Raw_Appts_YTD sheet with appointments
- `testConnection()` - Verifies API connection works

### ChatGPT Actions
ChatGPT can call these by sending:
```json
POST {web_app_url}
{
  "secret": "your-api-secret",
  "action": "run_invoice_update"
}
```

Available actions:
- `run_invoice_update`
- `run_appts_update`
- `test_connection`

## Troubleshooting

### "API error 401: unauthorized"
- Check that `API_SECRET` in Script Properties matches `apiSecret` in client config

### "API error 404: client_not_found"
- Verify `CLIENT_ID` in Code.gs matches folder name in `clients/`

### "Missing API_SECRET in Script Properties"
- You forgot to set the Script Property (see Setup step 3)

### "Cannot connect to API"
- Check `API_BASE_URL` is correct (localhost for testing, Vercel URL for production)
- Make sure your API is running (`npm run dev` locally)

## Comparison: Old vs New

**Before (500 lines):**
- All CRM API logic in Apps Script
- Data transformation in Apps Script
- Hard to maintain, hard to reuse

**After (80 lines):**
- Apps Script just calls API and writes to sheets
- All business logic in TypeScript API
- Easy to maintain, fully reusable for other clients