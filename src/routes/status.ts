import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { hasCRM } from '../connectors/factory';

const router = Router();

router.post('/client-status', (req: AuthenticatedRequest, res: Response) => {
  const clientConfig = req.clientConfig!;
  res.json({
    ok: true,
    clientId: req.clientId,
    clientName: clientConfig.clientName,
    hasCRM: hasCRM(clientConfig.crm),
    crmType: clientConfig.crm.type,
    timezone: clientConfig.timezone,
    timestamp: new Date().toISOString(),
  });
});

export default router;
