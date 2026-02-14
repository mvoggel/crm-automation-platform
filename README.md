# CRM Automation Platform

Multi-tenant automation platform for field service businesses. Connects CRMs to spreadsheets and enables AI-powered reporting.

## 🚀 Features

- **Multi-CRM Support**: LeadConnector, ServiceTitan, Jobber (more coming)
- **Spreadsheet Integration**: Google Sheets & Excel
- **AI-Powered Reports**: ChatGPT integration for conversational data access
- **Route Optimization**: Coming soon
- **Multi-Tenant**: Secure isolation, one codebase serves multiple clients
- **Flexible**: Works with or without a CRM

## 📁 Project Structure
```
crm-automation-platform/
├── src/                    # Core API (TypeScript)
│   ├── connectors/        # CRM integrations
│   ├── services/          # Business logic
│   ├── routes/            # API endpoints
│   ├── middleware/        # Auth, logging, errors
│   ├── types/             # TypeScript definitions
│   └── utils/             # Helpers (dates, cache)
├── clients/               # Client configs (gitignored)
├── integrations/          # Apps Script, Power Automate
├── packages/              # Route optimizer, etc.
└── tests/                 # Test suites
```

## 🛠️ Local Development
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 🔐 Security

- API key authentication per client
- Client data isolation (multi-tenant)
- No data storage (pass-through only)
- Credentials in environment variables

## 📊 Current Status

- ✅ Core API complete
- ✅ LeadConnector integration
- ✅ Google Sheets integration
- ✅ Apps Script client
- ⏳ Vercel deployment
- ⏳ Excel/Power Automate template
- ⏳ Route optimizer integration

## 📝 Adding a New Client

See `clients/_template/README.md`

## 🧪 Testing
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## 📖 Documentation

- [Technical Architecture](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [Client Onboarding](./clients/_template/README.md)
- [Apps Script Setup](./integrations/apps-script/README.md)

## 🤝 Clients

Currently serving:
- South Jersey Blinds (LeadConnector → Google Sheets)

## 📄 License

Proprietary - All Rights Reserved