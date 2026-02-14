# Technical Architecture Documentation

## Overview

This platform is a **multi-tenant CRM automation system** that connects various CRMs to spreadsheet outputs (Google Sheets, Excel) and enables AI-powered conversational data access via ChatGPT.

**Core Value Proposition**: Write business logic once, serve multiple clients with different CRMs and output preferences.

---

## System Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  (What clients interact with)                                    │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌──────────┐        ┌──────────┐        ┌──────────┐
  │  Google  │        │  Excel   │        │ ChatGPT  │
  │  Sheets  │        │  Online  │        │ Assistant│
  └─────┬────┘        └─────┬────┘        └─────┬────┘
        │                   │                    │
        │                   │                    │
┌───────▼───────────────────▼────────────────────▼─────────────┐
│              INTEGRATION LAYER                                 │
│  (Thin clients - minimal logic)                                │
├────────────────────────────────────────────────────────────────┤
│  • Apps Script (~80 lines)                                     │
│  • Power Automate Flow                                         │
│  • ChatGPT Actions (OpenAPI)                                   │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            │ HTTPS + Bearer Auth
                            │
┌───────────────────────────▼────────────────────────────────────┐
│                    CORE API LAYER                               │
│  (Node.js/TypeScript - Hosted on Vercel)                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Authentication Middleware                                │ │
│  │  • Validates API secrets                                  │ │
│  │  • Loads client config                                    │ │
│  │  • Enforces data isolation                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                            │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐  │
│  │  Route Handlers                                          │  │
│  │  • POST /api/sync-invoices                               │  │
│  │  • POST /api/sync-appointments                           │  │
│  │  • POST /api/upload-data (for non-CRM clients)           │  │
│  │  • POST /api/client-status                               │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────▼───────────────────────────────┐  │
│  │  Service Layer (Business Logic)                          │  │
│  │  • InvoiceService: Fetch, filter, transform              │  │
│  │  • AppointmentService: Calendar data                     │  │
│  │  • CommissionCalculator: Custom calculations            │  │
│  │  • RouteOptimizer: Future feature                        │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────▼───────────────────────────────┐  │
│  │  CRM Connector Layer (Abstraction)                       │  │
│  │  • Factory Pattern: createCRMConnector(config)           │  │
│  │  • Base Class: CRMConnector (interface)                  │  │
│  │  • Implementations:                                       │  │
│  │    - LeadConnectorCRM                                     │  │
│  │    - ServiceTitanCRM (future)                            │  │
│  │    - JobberCRM (future)                                   │  │
│  │    - SpreadsheetCRM (no CRM, manual data)               │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                    DATA LAYER                                    │
│  (External systems - not owned by us)                            │
├──────────────────────────────────────────────────────────────────┤
│  • LeadConnector/GHL API                                         │
│  • ServiceTitan API                                              │
│  • Jobber API                                                    │
│  • Client's Google Sheets                                        │
│  • Client's Excel files                                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Deep Dive

### **1. Authentication & Multi-Tenancy**

**File**: `src/middleware/auth.ts`

**How it works**:
```typescript
1. Extract API secret from Authorization header
2. Extract clientId from request body/query/header
3. Load client config from filesystem: clients/{clientId}/config.json
4. Verify secret matches: providedSecret === clientConfig.apiSecret
5. Attach clientConfig to request object
6. Pass to next middleware/route
```

**Security guarantees**:
- Client A's secret cannot access Client B's data
- Each request explicitly identifies the client
- Config files are gitignored (never committed)
- Path traversal attacks prevented by sanitization

**Example**:
```bash
# Client A request
curl POST /api/sync-invoices \
  -H "Authorization: Bearer client-a-secret" \
  -d '{"clientId": "client-a"}'
  
→ Loads clients/client-a/config.json
→ Uses client-a's CRM credentials
→ Returns client-a's data

# Client B request (different secret)
curl POST /api/sync-invoices \
  -H "Authorization: Bearer client-b-secret" \
  -d '{"clientId": "client-b"}'
  
→ Loads clients/client-b/config.json
→ Uses client-b's CRM credentials
→ Returns client-b's data
```

---

### **2. CRM Connector Architecture**

**Files**: 
- `src/connectors/base.ts` (interface)
- `src/connectors/factory.ts` (factory pattern)
- `src/connectors/leadconnector.ts` (implementation)

**Design Pattern**: Strategy Pattern + Factory Pattern

**Why this design**:
- **Open/Closed Principle**: Easy to add new CRMs without modifying existing code
- **Dependency Inversion**: Services depend on abstractions, not concrete implementations
- **Testability**: Can mock CRM responses for testing

**Base Interface**:
```typescript
abstract class CRMConnector {
  abstract fetchInvoices(start: Date, end: Date): Promise<Invoice[]>
  abstract fetchAppointments(...): Promise<Appointment[]>
  abstract fetchContact(id: string): Promise<Contact>
  abstract healthCheck(): Promise<boolean>
}
```

**Every CRM implementation must**:
1. Extend `CRMConnector`
2. Implement all required methods
3. Transform their API responses to our standard format
4. Handle their specific authentication

**Factory creates the right connector**:
```typescript
const crm = createCRMConnector(clientConfig.crm)
// Returns: LeadConnectorCRM | ServiceTitanCRM | JobberCRM | etc.
```

**Adding a new CRM** (e.g., Housecall Pro):
```typescript
// 1. Create src/connectors/housecallpro.ts
export class HousecallProCRM extends CRMConnector {
  async fetchInvoices(start, end) {
    // Call Housecall Pro API
    // Transform their format → our Invoice type
  }
  // ... implement other methods
}

// 2. Add to factory.ts
case 'housecallpro':
  return new HousecallProCRM(config);

// 3. Done! All existing code works with new CRM
```

---

### **3. Data Transformation Pipeline**

**The journey of an invoice from CRM to spreadsheet**:
```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Fetch from CRM                                          │
│ LeadConnector API returns:                                       │
│ {                                                                │
│   _id: "inv123",                                                 │
│   invoiceNumber: "001",                                          │
│   total: 1000,                                                   │
│   issueDate: "2026-02-10T10:00:00Z",                            │
│   contactDetails: { id: "contact1", name: "John" }              │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Normalize to Standard Format                            │
│ LeadConnectorCRM.normalizeInvoices() transforms to:             │
│ Invoice {                                                        │
│   id: "inv123",           // Standardized field names           │
│   invoiceNumber: "001",                                          │
│   total: 1000,                                                   │
│   issueDate: "2026-02-10T10:00:00Z",                            │
│   contactDetails: Contact { ... }                               │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Enrich with Owner Data                                  │
│ InvoiceService.buildOwnerLookup():                              │
│ 1. Extract unique contact IDs                                   │
│ 2. Fetch each contact from CRM (with caching)                   │
│ 3. Extract owner/salesperson from contact                       │
│ 4. Build Map<contactId, Owner>                                  │
│                                                                  │
│ Result: ownerMap = {                                            │
│   "contact1": { ownerId: "owner1", ownerName: "Rob Smith" }     │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Transform to Spreadsheet Rows                           │
│ InvoiceService.transformToRows():                               │
│ InvoiceRow {                                                     │
│   invoice_id: "inv123",                                          │
│   invoice_number: "001",                                         │
│   invoice_display: "INV-001",                                    │
│   amount_total: 1000,                                            │
│   issue_date: "02/10/2026",  // Formatted for timezone          │
│   owner_id: "owner1",         // From enrichment step           │
│   owner_name: "Rob Smith",    // From enrichment step           │
│   contact_name: "John",                                          │
│   ...                                                            │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Convert to Arrays for Sheets                            │
│ rowsToArrays():                                                  │
│ [                                                                │
│   ["inv123", "001", "INV-001", 1000, "02/10/2026", ...],       │
│   ["inv124", "002", "INV-002", 2000, "02/11/2026", ...],       │
│ ]                                                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Return to Client                                        │
│ API Response: {                                                  │
│   ok: true,                                                      │
│   headers: ["invoice_id", "invoice_number", ...],               │
│   rows: [["inv123", "001", ...], [...]],                        │
│   count: 47                                                      │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: Apps Script Writes to Sheet                             │
│ sheet.getRange(2, 1, rows.length, headers.length)               │
│      .setValues(rows);                                           │
└─────────────────────────────────────────────────────────────────┘
```

**Key design decisions**:

1. **Standardization at connector level**: Each CRM connector normalizes to our `Invoice` type immediately
2. **Enrichment is separate**: Owner lookup is a distinct step with caching
3. **Timezone handling**: All dates formatted in client's timezone
4. **Type safety**: TypeScript ensures data structure consistency
5. **Array conversion**: Last step, because objects are easier to work with in TypeScript

---

### **4. Caching Strategy**

**Problem**: Fetching contact data for owner lookup can be slow (1 API call per unique contact)

**Solution**: Multi-layer caching
```typescript
// In-memory cache (lasts until server restart)
class InMemoryCache {
  private cache: Map<string, CacheEntry>
  
  get(key: string): any | null
  set(key: string, value: any, ttlSeconds: number)
}

// Usage in LeadConnector connector
async getOwnerByContactId(contactId: string): Promise<Owner> {
  const cacheKey = `lc:owner:${contactId}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) return cached;  // Instant return!
  
  // Cache miss - fetch from API
  const contact = await this.fetchContact(contactId);
  const owner = this.extractOwner(contact);
  
  // Store for 6 hours
  cache.set(cacheKey, owner, 21600);
  
  return owner;
}
```

**Performance impact**:
- **Without caching**: 47 invoices with 15 unique contacts = 15 API calls
- **With caching**: First run = 15 API calls, subsequent runs = 0 API calls
- **Rate limiting**: Pause every 25 requests to avoid hitting API limits

---

### **5. Date & Timezone Handling**

**Problem**: Invoices created at midnight can appear in wrong month due to timezone conversion

**Solution**: Timezone-aware date utilities
```typescript
// All dates formatted in client's configured timezone
export function fmtDateMDY(
  isoString: string,
  timezone: string = 'America/New_York'
): string {
  const d = new Date(isoString);
  // Use UTC methods to avoid local timezone issues
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

// Month boundaries calculated in local timezone
export function monthWindowLocalMs(year: number, month: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}
```

**Why this matters**:
- Client in New York (EST) creates invoice at 11:59 PM on Jan 31
- Without timezone handling: Could appear as Feb 1 in UTC
- With timezone handling: Correctly appears as Jan 31

---

## Data Flow Examples

### **Example 1: Monthly Invoice Sync**
```
1. ChatGPT user: "Refresh this month's invoices"
   
2. ChatGPT Action calls Apps Script Web App:
   POST https://script.google.com/macros/.../exec
   { secret: "...", action: "run_invoice_update" }

3. Apps Script calls our API:
   POST https://your-api.vercel.app/api/sync-invoices
   Headers: Authorization: Bearer {client-secret}
   Body: { clientId: "south-jersey-blinds", action: "thisMonth" }

4. Auth middleware:
   - Loads clients/south-jersey-blinds/config.json
   - Verifies secret matches
   - Attaches config to request

5. Route handler:
   - Creates LeadConnectorCRM instance
   - Calculates month boundaries (Feb 1 - Mar 1, 2026)
   - Calls crm.fetchInvoices(start, end)

6. LeadConnector connector:
   - Makes paginated API calls to LeadConnector
   - Handles rate limiting
   - Normalizes response to Invoice[] format

7. InvoiceService:
   - Builds owner lookup (15 contacts → 15 API calls, cached)
   - Transforms invoices to InvoiceRow[] objects
   - Converts objects to arrays

8. API returns:
   { ok: true, headers: [...], rows: [[...]], count: 47 }

9. Apps Script:
   - Writes headers to row 1
   - Writes 47 data rows starting at row 2
   - Adds note with timestamp

10. Google Sheet updates automatically
    User sees fresh data in spreadsheet!
```

---

### **Example 2: Client Without CRM**
```
Client: "Joe's Landscaping" has no CRM yet

1. Client config:
   {
     "clientId": "joes-landscaping",
     "crm": { "type": "spreadsheet" }  // No CRM!
   }

2. Apps Script calls:
   POST /api/upload-data
   Body: {
     clientId: "joes-landscaping",
     dataType: "invoices",
     rows: [
       { invoice_number: "001", total: 500, ... },
       { invoice_number: "002", total: 750, ... }
     ]
   }

3. API validates data structure
   Returns standardized format

4. Apps Script writes to their Google Sheet
   They can track data even without a CRM!

5. Later, when they get a CRM:
   - Update config: crm: { type: "servicetitan", ... }
   - No Apps Script changes needed
   - No spreadsheet changes needed
   - Just works!
```

---

## Technology Choices & Rationale

### **Why TypeScript?**
- **Type safety**: Catch errors at compile time
- **IDE support**: Autocomplete, refactoring
- **Self-documenting**: Types serve as documentation
- **Maintainability**: Easier to refactor with confidence

### **Why Express.js?**
- **Simplicity**: Minimal boilerplate
- **Ecosystem**: Huge middleware library
- **Performance**: Fast enough for our use case
- **Deployment**: Works great on Vercel

### **Why Vercel?**
- **Zero config**: Just push to deploy
- **Serverless**: Scales automatically
- **Cost**: Free tier handles most SMB workloads
- **Speed**: Global CDN, fast cold starts

### **Why Apps Script thin client?**
- **Reusability**: Business logic in API, not trapped in Apps Script
- **Maintainability**: 80 lines vs 500 lines
- **Flexibility**: Same API works for Excel, web apps, etc.
- **Testing**: Can't unit test Apps Script easily, can test TypeScript

### **Why multi-tenant over template?**
- **Maintenance**: Fix once, all clients benefit
- **Cost**: One deployment vs many
- **Features**: New features automatically available to all
- **Consistency**: Same version for everyone
- **Scale**: 100 clients doesn't mean 100x work

---

## Performance Characteristics

### **API Response Times**

| Endpoint | Typical | Slow | Notes |
|----------|---------|------|-------|
| /api/client-status | 50ms | 200ms | Config load only |
| /api/sync-invoices (7 days) | 2-5s | 10s | Depends on # of invoices |
| /api/sync-invoices (YTD) | 10-30s | 60s | Many API calls, caching helps |
| /api/sync-appointments | 3-8s | 15s | Multiple users queried |

**Bottlenecks**:
1. CRM API response time (external, out of our control)
2. Owner lookup (mitigated by caching)
3. Google Sheets write speed (Apps Script side)

**Optimizations applied**:
- Owner lookup caching (6-hour TTL)
- Rate limiting to avoid API throttling
- Pagination for large datasets
- Batch processing where possible

---

## Security Model

### **Threat Model**

**What we protect against**:
- ✅ Unauthorized API access (API key authentication)
- ✅ Cross-client data access (client ID verification)
- ✅ Path traversal attacks (input sanitization)
- ✅ Credential exposure (gitignored configs, env vars)

**What we don't protect against** (out of scope):
- ❌ Compromised client credentials (their responsibility)
- ❌ Apps Script deployment URL leaks (Google's security model)
- ❌ DDoS attacks (Vercel handles this)

### **Authentication Flow**
```
1. Client makes request with:
   Authorization: Bearer {secret}
   Body: { clientId: "client-a" }

2. Auth middleware:
   a. Extract secret from header
   b. Extract clientId from body
   c. Load clients/{clientId}/config.json
   d. Compare secrets:
      if (providedSecret !== config.apiSecret) → 401 Unauthorized
      
3. If match:
   - Attach config to request
   - Pass to route handler
   
4. Route handler uses config:
   - config.crm → Connect to THEIR CRM
   - config.timezone → Format dates for THEIR timezone
   - config.teamUserIds → Query THEIR team members
```

**Key insight**: The clientId + secret combo ensures Client A's secret cannot access Client B's data, even if Client A somehow knew Client B's clientId.

---

## Testing Strategy

### **Unit Tests**
- **What**: Individual functions in isolation
- **Where**: `*.test.ts` files next to source
- **Coverage**: 70%+ for core logic
- **Examples**:
  - Date formatting utilities
  - Invoice transformation logic
  - Owner extraction from various formats

### **Integration Tests**
- **What**: Multiple components working together
- **Where**: `tests/integration/`
- **Examples**:
  - Full invoice sync flow (mocked CRM)
  - Authentication + route handler
  - Client isolation enforcement

### **Manual Testing**
- **What**: Real CRM API calls, real spreadsheets
- **When**: Before production deployment
- **Process**:
  1. Create test client config
  2. Run sync with ngrok tunnel
  3. Verify data in test spreadsheet
  4. Check edge cases (empty data, errors, etc.)

---

## Deployment

### **Local Development**
```bash
npm run dev  # Port 3000
ngrok http 3000  # Expose to internet for Apps Script testing
```

### **Production (Vercel)**
```bash
vercel  # Deploys to https://{project}.vercel.app
```

**Environment variables in Vercel**:
- Set in Vercel dashboard, not in code
- Each environment (development, preview, production) can have different values
- Client configs NOT deployed (must be in filesystem or move to database)

---

## Monitoring & Observability

**Current state**:
- ✅ Request logging (method, path, status, duration, clientId)
- ✅ Error logging to console (captured by Vercel)
- ⏳ Structured logging (Winston/Pino) - future
- ⏳ Error tracking (Sentry) - future
- ⏳ Performance monitoring (Vercel Analytics) - future

**What to monitor**:
- API response times by endpoint
- Error rates by client
- CRM API failures
- Cache hit rates
- Authentication failures

---

## Future Architecture Considerations

### **If Client Count Grows (10+ clients)**

**Current**: Client configs in filesystem
**Problem**: Manual file management, no version control per client
**Solution**: Move to database (PostgreSQL, MongoDB)
```typescript
// Instead of:
const config = loadFromFile(`clients/${clientId}/config.json`)

// Use:
const config = await db.clientConfigs.findOne({ clientId })
```

### **If Data Volume Grows (100K+ invoices/month)**

**Current**: Fetch all invoices, filter in memory
**Problem**: Slow, memory-intensive
**Solution**: Push filtering to CRM API
```typescript
// Instead of:
const all = await crm.fetchAllInvoices()
const filtered = all.filter(inv => inv.date >= start && inv.date < end)

// Use:
const filtered = await crm.fetchInvoices({ startDate: start, endDate: end })
```

### **If Response Times Become Critical**

**Current**: Synchronous request/response
**Problem**: Long-running requests timeout
**Solution**: Job queue + webhooks
```typescript
// Instead of:
POST /api/sync-invoices
→ Wait 30 seconds
← { ok: true, rows: [...] }

// Use:
POST /api/sync-invoices
→ Immediate response
← { ok: true, jobId: "abc123" }

// Job runs in background, calls webhook when done
POST {client_webhook_url}
{ jobId: "abc123", status: "complete", rows: [...] }
```

---

## Code Quality Standards

### **Naming Conventions**
- **Files**: kebab-case (`invoice-service.ts`)
- **Classes**: PascalCase (`InvoiceService`)
- **Functions**: camelCase (`fetchInvoices`)
- **Constants**: UPPER_SNAKE_CASE (`API_VERSION`)
- **Interfaces**: PascalCase (`Invoice`, `CRMConfig`)

### **File Organization**
```
src/
├── connectors/       # One file per CRM
├── services/         # One file per domain (invoices, appointments)
├── routes/           # One file per resource group (sync, admin)
├── middleware/       # One file per middleware (auth, logging)
├── types/            # One file per domain (crm.ts, config.ts)
└── utils/            # One file per utility category (date, cache)
```

### **Error Handling**
```typescript
// Always try/catch in route handlers
router.post('/endpoint', async (req, res) => {
  try {
    // ... logic
  } catch (error: any) {
    console.error('Descriptive error message:', error);
    res.status(500).json({
      ok: false,
      error: 'error_code',
      message: error.message
    });
  }
});

// Throw descriptive errors
throw new Error('LeadConnector API error: Invalid credentials');
// Not: throw new Error('Error');
```

---

## Glossary

**Terms used throughout codebase**:

- **Client**: A business paying for the service (e.g., "South Jersey Blinds")
- **CRM**: Customer Relationship Management system (LeadConnector, ServiceTitan, etc.)
- **Connector**: Code that talks to a specific CRM's API
- **Multi-tenant**: One codebase serving multiple clients with data isolation
- **Thin client**: Minimal logic, just calls API and displays results (Apps Script)
- **Enrichment**: Adding related data (e.g., owner info from contacts)
- **Transformation**: Converting data format (CRM format → spreadsheet format)
- **Owner**: Salesperson/account owner assigned to a contact/opportunity
- **YTD**: Year-to-date (Jan 1 through today)

---

## References

- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Apps Script Reference](https://developers.google.com/apps-script/reference)
- [LeadConnector API Docs](https://docs.gohighlevel.com/)
- [Vercel Documentation](https://vercel.com/docs)