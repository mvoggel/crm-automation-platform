import request from 'supertest';
import express from 'express';
import invoiceRoutes from './invoices';
import appointmentRoutes from './appointments';
import statusRoutes from './status';

jest.mock('../connectors/leadconnector');

// Shared middleware: injects a mock clientConfig with a real CRM
function withCRM(app: express.Application) {
  app.use((req: any, _res, next) => {
    req.clientConfig = {
      clientId: 'test-client',
      clientName: 'Test Client',
      apiSecret: 'test-secret',
      crm: { type: 'leadconnector', apiToken: 'test-token', locationId: 'test-location' },
      spreadsheetId: 'test-sheet',
      timezone: 'America/New_York',
      teamUserIds: [],
    };
    req.clientId = 'test-client';
    next();
  });
}

function withNoCRM(app: express.Application) {
  app.use((req: any, _res, next) => {
    req.clientConfig = {
      clientId: 'no-crm-client',
      crm: { type: 'spreadsheet' },
      timezone: 'America/New_York',
      teamUserIds: [],
    };
    req.clientId = 'no-crm-client';
    next();
  });
}

describe('Invoice routes', () => {
  it('rejects client without CRM', async () => {
    const app = express();
    app.use(express.json());
    withNoCRM(app);
    app.use('/api', invoiceRoutes);

    const res = await request(app).post('/api/sync-invoices').send({ action: 'ytd' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_crm_configured');
  });

  it('rejects invalid action', async () => {
    const app = express();
    app.use(express.json());
    withCRM(app);
    app.use('/api', invoiceRoutes);

    const res = await request(app).post('/api/sync-invoices').send({ action: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_action');
  });

  it('rejects custom action with missing dates', async () => {
    const app = express();
    app.use(express.json());
    withCRM(app);
    app.use('/api', invoiceRoutes);

    const res = await request(app).post('/api/sync-invoices').send({ action: 'custom' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_dates');
  });
});

describe('Appointment routes', () => {
  it('rejects invalid action', async () => {
    const app = express();
    app.use(express.json());
    withCRM(app);
    app.use('/api', appointmentRoutes);

    const res = await request(app).post('/api/sync-appointments').send({ action: 'monthly' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_action');
  });
});

describe('Status route', () => {
  it('returns client status', async () => {
    const app = express();
    app.use(express.json());
    withCRM(app);
    app.use('/api', statusRoutes);

    const res = await request(app).post('/api/client-status').send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.hasCRM).toBe(true);
    expect(res.body.crmType).toBe('leadconnector');
  });
});
