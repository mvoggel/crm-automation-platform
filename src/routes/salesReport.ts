/** GET /api/sales-report — returns sales metrics for a given salesperson and date range. */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getSheetRange } from '../services/sheetsService';

const router = Router();

router.get('/sales-report', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { salesperson, start, end } = req.query as Record<string, string>;

    if (!salesperson || !start || !end) {
      return res.status(400).json({
        ok: false,
        error: 'missing_params',
        message: 'salesperson, start, and end query params are required',
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_dates',
        message: 'start and end must be valid YYYY-MM-DD dates',
      });
    }

    const spreadsheetId = req.clientConfig!.spreadsheetId;

    // ── Master_Data: compute sales metrics ──────────────────────────────────
    // Col A=date, B=salesperson, C=source, F=total_generated, G=cogs, M=commission
    const masterRows = await getSheetRange(spreadsheetId, 'Master_Data!A2:M');

    let total_generated = 0;
    let cogs_total = 0;
    let commission_earned = 0;
    let total_sales = 0;

    for (const row of masterRows) {
      const dateStr = row[0];
      const rowSalesperson = row[1];
      const source = row[2];

      if (!dateStr || !rowSalesperson) continue;
      if (source?.toLowerCase() === 'ignore') continue;
      if (rowSalesperson.toLowerCase() !== salesperson.toLowerCase()) continue;

      const rowDate = new Date(dateStr);
      if (isNaN(rowDate.getTime())) continue;
      if (rowDate < startDate || rowDate > endDate) continue;

      total_generated += parseFloatSafe(row[5]);   // col F
      cogs_total      += parseFloatSafe(row[6]);   // col G
      commission_earned += parseFloatSafe(row[12]); // col M
      total_sales++;
    }

    const margin = total_generated - cogs_total;
    const margin_rate = total_generated > 0 ? margin / total_generated : 0;

    // ── internal_map: look up salesperson's user_id ──────────────────────────
    // Col A=user_id, B=name
    const mapRows = await getSheetRange(spreadsheetId, 'internal_map!A2:B');
    let userId: string | null = null;

    for (const row of mapRows) {
      if (row[1]?.toLowerCase() === salesperson.toLowerCase()) {
        userId = row[0];
        break;
      }
    }

    // ── Raw_Appts_YTD: count confirmed appointments ──────────────────────────
    // Col A=user_id, D=date, E=status
    let total_appointments = 0;

    if (userId) {
      const apptRows = await getSheetRange(spreadsheetId, 'Raw_Appts_YTD!A2:E');
      for (const row of apptRows) {
        if (row[0] !== userId) continue;
        if (row[4]?.toLowerCase() !== 'confirmed') continue;

        const apptDate = new Date(row[3]);
        if (isNaN(apptDate.getTime())) continue;
        if (apptDate < startDate || apptDate > endDate) continue;

        total_appointments++;
      }
    }

    const closing_rate = total_appointments > 0 ? total_sales / total_appointments : 0;

    return res.json({
      ok: true,
      salesperson,
      period: { start, end },
      total_generated:  round2(total_generated),
      cogs_total:       round2(cogs_total),
      margin:           round2(margin),
      margin_rate:      round4(margin_rate),
      commission_earned: round2(commission_earned),
      total_sales,
      total_appointments,
      closing_rate:     round4(closing_rate),
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'report_failed', message: error.message });
  }
});

function parseFloatSafe(val: string | undefined): number {
  const n = parseFloat((val || '').replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : n;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function round4(n: number) { return Math.round(n * 10000) / 10000; }

export default router;
