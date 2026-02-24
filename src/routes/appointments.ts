/** POST /api/sync-appointments — fetches YTD calendar appointment data for the client's team. */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { createCRMConnector, hasCRM } from '../connectors/factory';

const router = Router();

const APPT_HEADERS = ['user_id', 'event_id', 'event_title', 'appt_date', 'status', 'contact_id', 'contact_name'];

router.post('/sync-appointments', async (req: AuthenticatedRequest, res: Response) => {
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
    const ytdYear = year || new Date().getFullYear();
    const start = new Date(ytdYear, 0, 1);
    const end = new Date(ytdYear + 1, 0, 1);

    const appointments = await crm.fetchAppointments(clientConfig.teamUserIds, start, end);

    const rows = appointments.map(apt => [
      apt.userId,
      apt.id,
      apt.title,
      new Date(apt.startTime).toLocaleDateString('en-US', { timeZone: clientConfig.timezone }),
      apt.status,
      apt.contactId,
      apt.contactName,
    ]);

    res.json({ ok: true, action, clientId: req.clientId, headers: APPT_HEADERS, rows, count: rows.length });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'sync_failed', message: error.message });
  }
});

export default router;
