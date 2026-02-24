import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { createCRMConnector, hasCRM } from '../connectors/factory';
import { InvoiceService } from '../services/invoiceService';
import { buildPaymentMap, toPaymentTypeRows, PAYMENT_TYPE_HEADERS } from '../services/paymentService';

const router = Router();

router.post('/sync-payment-types', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, year } = req.body;
    const clientConfig = req.clientConfig!;

    if (!hasCRM(clientConfig.crm)) {
      return res.status(400).json({ ok: false, error: 'no_crm_configured' });
    }

    if (action !== 'ytd') {
      return res.status(400).json({ ok: false, error: 'invalid_action', message: `Unknown action: ${action}. Only 'ytd' is supported.` });
    }

    const crm = createCRMConnector(clientConfig.crm);
    const service = new InvoiceService(crm);
    const ytdYear = year || new Date().getFullYear();
    const start = new Date(ytdYear, 0, 1);
    const end = new Date(ytdYear + 1, 0, 1);

    const [invoices, transactions] = await Promise.all([
      service.fetchInvoicesForYear(ytdYear),
      crm.fetchTransactions(start, end),
    ]);

    const paymentMap = buildPaymentMap(transactions, start.getTime(), end.getTime());
    const rows = toPaymentTypeRows(invoices, paymentMap, clientConfig.timezone);

    res.json({ ok: true, action, clientId: req.clientId, headers: PAYMENT_TYPE_HEADERS, rows, count: rows.length });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'sync_failed', message: error.message });
  }
});

export default router;
