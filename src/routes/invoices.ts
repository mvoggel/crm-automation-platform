/** POST /api/sync-invoices — fetches and transforms invoice data from the CRM for a given date range. */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { createCRMConnector, hasCRM } from '../connectors/factory';
import { InvoiceService } from '../services/invoiceService';
import { cache } from '../utils/cache';

const router = Router();

function rowsToArrays(rows: any[], headers: string[]): any[][] {
  return rows.map(row => headers.map(h => row[h] !== undefined ? row[h] : ''));
}

router.post('/sync-invoices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    cache.clear();
    const { action, year, month, startDate, endDate } = req.body;
    const clientConfig = req.clientConfig!;

    if (!hasCRM(clientConfig.crm)) {
      return res.status(400).json({ ok: false, error: 'no_crm_configured' });
    }

    const crm = createCRMConnector(clientConfig.crm);
    const service = new InvoiceService(crm);
    const now = new Date();
    let invoices;

    switch (action) {
      case 'ytd':
        invoices = await service.fetchInvoicesForYear(year || now.getFullYear());
        break;
      case 'thisMonth':
        invoices = await service.fetchInvoicesForMonth(now.getFullYear(), now.getMonth() + 1);
        break;
      case 'lastMonth': {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        invoices = await service.fetchInvoicesForMonth(d.getFullYear(), d.getMonth() + 1);
        break;
      }
      case 'last7days': {
        const from = new Date(); from.setDate(from.getDate() - 7);
        invoices = await crm.fetchInvoices(from, now);
        break;
      }
      case 'last30days': {
        const from = new Date(); from.setDate(from.getDate() - 30);
        invoices = await crm.fetchInvoices(from, now);
        break;
      }
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ ok: false, error: 'missing_dates', message: 'custom action requires startDate and endDate' });
        }
        invoices = await crm.fetchInvoices(new Date(startDate), new Date(endDate));
        break;
      default:
        return res.status(400).json({ ok: false, error: 'invalid_action', message: `Unknown action: ${action}` });
    }

    const ownerMap = await service.buildOwnerLookup(invoices);
    const rowObjects = service.transformToRows(invoices, ownerMap, clientConfig.timezone);
    const headers = service.getHeaders();

    res.json({ ok: true, action, clientId: req.clientId, headers, rows: rowsToArrays(rowObjects, headers), count: invoices.length });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'sync_failed', message: error.message });
  }
});

export default router;
