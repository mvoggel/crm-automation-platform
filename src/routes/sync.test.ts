import request from 'supertest';
import express from 'express';
import syncRoutes from './sync';
import { authMiddleware } from '../middleware/auth';
import { clientConfigLoader } from '../config/clientLoader';

// Mock dependencies
jest.mock('../config/clientLoader');
jest.mock('../connectors/leadconnector');

const mockClientConfigLoader = clientConfigLoader as jest.Mocked<typeof clientConfigLoader>;

describe('Sync Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock auth to inject clientConfig
    app.use((req: any, res, next) => {
      req.clientConfig = {
        clientId: 'test-client',
        clientName: 'Test Client',
        apiSecret: 'test-secret',
        crm: {
          type: 'leadconnector',
          apiToken: 'test-token',
          locationId: 'test-location',
        },
        spreadsheetId: 'test-sheet',
        timezone: 'America/New_York',
        teamUserIds: [],
      };
      req.clientId = 'test-client';
      next();
    });

    app.use('/api', syncRoutes);
  });

  describe('POST /api/sync-invoices', () => {
    it('rejects client without CRM', async () => {
      app = express();
      app.use(express.json());
      app.use((req: any, res, next) => {
        req.clientConfig = {
          clientId: 'no-crm-client',
          crm: { type: 'spreadsheet' }, // No CRM
          timezone: 'America/New_York',
          teamUserIds: [],
        };
        req.clientId = 'no-crm-client';
        next();
      });
      app.use('/api', syncRoutes);

      const response = await request(app)
        .post('/api/sync-invoices')
        .send({ action: 'ytd' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('no_crm_configured');
      expect(response.body.suggestion).toContain('upload-data');
    });

    it('rejects invalid action', async () => {
      const response = await request(app)
        .post('/api/sync-invoices')
        .send({ action: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_action');
    });
  });

  describe('POST /api/upload-data', () => {
    it('accepts manual data upload', async () => {
      const response = await request(app)
        .post('/api/upload-data')
        .send({
          dataType: 'invoices',
          rows: [
            { invoice_id: '1', total: 1000 },
            { invoice_id: '2', total: 2000 },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.count).toBe(2);
    });

    it('rejects invalid upload request', async () => {
      const response = await request(app)
        .post('/api/upload-data')
        .send({ dataType: 'invoices' }); // Missing rows

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });
  });

  describe('GET /api/client-status', () => {
    it('returns client configuration status', async () => {
      const response = await request(app).get('/api/client-status');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.hasCRM).toBe(true);
      expect(response.body.crmType).toBe('leadconnector');
    });
  });
});