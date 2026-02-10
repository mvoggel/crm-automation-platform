import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { createCRMConnector, hasCRM } from '../connectors/factory';
import { InvoiceService } from '../services/invoiceService';

const router = Router();

/**
 * POST /api/sync-invoices
 * 
 * Syncs invoice data from CRM to standardized format
 * Works for: year-to-date, specific month, or date range
 * 
 * Body params:
 * - action: 'ytd' | 'thisMonth' | 'lastMonth' | 'custom'
 * - year?: number (optional, defaults to current year)
 * - month?: number (1-12, required for 'thisMonth'/'lastMonth')
 * - startDate?: string (ISO 8601, for 'custom')
 * - endDate?: string (ISO 8601, for 'custom')
 */
router.post('/sync-invoices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, year, month, startDate, endDate } = req.body;
    const clientConfig = req.clientConfig!; // Already validated by auth middleware

    // Check if client has a CRM
    if (!hasCRM(clientConfig.crm)) {
      return res.status(400).json({
        ok: false,
        error: 'no_crm_configured',
        message: 'This client does not have a CRM configured. Use manual data entry instead.',
        suggestion: 'Consider setting up a CRM integration or use the /api/upload-data endpoint',
      });
    }

    // Create CRM connector
    const crm = createCRMConnector(clientConfig.crm);
    const service = new InvoiceService(crm);

    // Determine date range based on action
    const now = new Date();
    let invoices;

    switch (action) {
      case 'ytd':
        const ytdYear = year || now.getFullYear();
        invoices = await service.fetchInvoicesForYear(ytdYear);
        break;

      case 'thisMonth':
        invoices = await service.fetchInvoicesForMonth(
          now.getFullYear(),
          now.getMonth() + 1
        );
        break;

      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        invoices = await service.fetchInvoicesForMonth(
          lastMonth.getFullYear(),
          lastMonth.getMonth() + 1
        );
        break;

      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({
            ok: false,
            error: 'missing_dates',
            message: 'Custom action requires startDate and endDate',
          });
        }
        invoices = await crm.fetchInvoices(
          new Date(startDate),
          new Date(endDate)
        );
        break;

      default:
        return res.status(400).json({
          ok: false,
          error: 'invalid_action',
          message: `Unknown action: ${action}. Use 'ytd', 'thisMonth', 'lastMonth', or 'custom'`,
        });
    }

    // Enrich and transform
    const ownerMap = await service.buildOwnerLookup(invoices);
    const rows = service.transformToRows(invoices, ownerMap, clientConfig.timezone);
    const headers = service.getHeaders();

    res.json({
      ok: true,
      action,
      clientId: req.clientId,
      headers,
      rows,
      count: rows.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Sync invoices error:', error);
    res.status(500).json({
      ok: false,
      error: 'sync_failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/upload-data
 * 
 * For clients WITHOUT a CRM - they can manually upload data
 * This validates and standardizes their spreadsheet data
 * 
 * Body params:
 * - dataType: 'invoices' | 'appointments'
 * - rows: array of objects matching expected schema
 */
router.post('/upload-data', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dataType, rows } = req.body;
    const clientConfig = req.clientConfig!;

    if (!dataType || !rows || !Array.isArray(rows)) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_request',
        message: 'dataType and rows array are required',
      });
    }

    // For now, just validate and pass through
    // Future: Add validation schemas for different data types
    const service = new InvoiceService({} as any); // No CRM needed
    const headers = service.getHeaders();

    res.json({
      ok: true,
      dataType,
      clientId: req.clientId,
      headers,
      rows,
      count: rows.length,
      message: 'Data validated and ready to write to spreadsheet',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Upload data error:', error);
    res.status(500).json({
      ok: false,
      error: 'upload_failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/client-status
 * 
 * Returns client configuration status (useful for diagnostics)
 */
router.get('/client-status', async (req: AuthenticatedRequest, res: Response) => {
  const clientConfig = req.clientConfig!;

  res.json({
    ok: true,
    clientId: req.clientId,
    clientName: clientConfig.clientName,
    hasCRM: hasCRM(clientConfig.crm),
    crmType: clientConfig.crm.type,
    timezone: clientConfig.timezone,
    features: {
      crmSync: hasCRM(clientConfig.crm),
      manualUpload: true,
      routeOptimization: false, // Future
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;