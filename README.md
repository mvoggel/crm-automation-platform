# CRM Automation Platform

Stateless, multi-tenant REST API that pulls operational data (invoices, appointments, payments) from CRMs, transforms it, and delivers it to reporting surfaces like Google Sheets.

## How it works

```
Google Sheets (Apps Script)  →  POST /api/sync-*  →  LeadConnector / HubSpot API
       ↑                              ↑
  writes rows              auth + client config
```

The Apps Script is a thin client (~100 lines) — it calls the API and writes rows to sheets. All business logic lives here.

## Project structure

```
src/
├── connectors/       # CRM API clients (LeadConnector, HubSpot)
├── services/         # Business logic (invoices, payment types)
├── routes/           # API endpoints (one file per endpoint)
├── middleware/       # Auth, logging, error handling
├── types/            # Shared TypeScript interfaces
└── utils/            # Date formatting, in-memory cache

clients/              # Per-client config files (gitignored)
integrations/
└── apps-script/      # Google Sheets thin client (code.gs, gitignored)
```

## API endpoints

| Endpoint | Description |
|---|---|
| `POST /api/sync-invoices` | YTD invoices with owner enrichment |
| `POST /api/sync-appointments` | YTD calendar appointments by team member |
| `POST /api/sync-payment-types` | Invoice × transaction join for payment method data |
| `POST /api/client-status` | Config health check |
| `GET /health` | Public uptime check |

All `/api/*` routes require:
- `Authorization: Bearer <apiSecret>` header
- `clientId` in request body

## Local development

```bash
npm install
npm run dev        # Start on :3000 with auto-reload
npm test           # Run test suite
npm run build      # Compile TypeScript
```

## Adding a client

1. Copy `clients/_template/` → `clients/{client-id}/`
2. Fill in `config.json` with CRM credentials and `apiSecret`
3. For production (Vercel): set `CLIENT_CONFIG_{CLIENT_ID_UPPER}` env var to the JSON

## Deployment (Vercel)

Required environment variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CLIENT_CONFIG_SOUTH_JERSEY_BLINDS` | Full `config.json` contents as JSON string |

Client ID → env var: `south-jersey-blinds` → `CLIENT_CONFIG_SOUTH_JERSEY_BLINDS`

## Current status

| Item | Status |
|---|---|
| LeadConnector integration | ✅ Production |
| Google Sheets (Apps Script) | ✅ Production |
| Invoice + appointment + payment sync | ✅ Complete |
| Multi-tenant auth | ✅ Complete |
| Vercel deployment | ✅ Configured |
| HubSpot connector | 🔶 Stub — contact data only |

## Security

- Bearer token per client (each client has its own `apiSecret`)
- Client data fully isolated — one client's token cannot access another's data
- No data stored — pure pass-through from CRM to caller
- Client configs and Apps Script are gitignored

## License

Proprietary — All Rights Reserved
