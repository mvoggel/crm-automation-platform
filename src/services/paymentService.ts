import { Invoice } from '../types/crm';
import { fmtDateMDY } from '../utils/date';

export const PAYMENT_TYPE_HEADERS = [
  'invoice_id', 'invoice_number', 'invoice_display', 'invoice_status',
  'amount_paid', 'amount_due', 'amount_total',
  'issue_date', 'due_date',
  'latest_payment_type', 'latest_payment_detail', 'latest_payment_date',
  'all_payment_types', 'all_payment_details',
];

interface PaymentBucket {
  types: Set<string>;
  details: Set<string>;
  latestMs: number | null;
  latestType: string;
  latestDetail: string;
}

function txnTimeMs(txn: any): number | null {
  const v = txn?.fulfilledAt || txn?.createdAt || txn?.updatedAt || '';
  if (!v) return null;
  const ms = new Date(v).getTime();
  return isNaN(ms) ? null : ms;
}

function normalizeType(t: string): string {
  const s = (t || '').trim().toLowerCase();
  return s === 'cheque' ? 'check' : s;
}

function derivePayment(txn: any): { type: string; detail: string } {
  const manualMode = txn?.chargeSnapshot?.mode;
  if (manualMode) {
    const chequeNo = txn?.chargeSnapshot?.cheque?.number || txn?.chargeSnapshot?.check?.number || '';
    return { type: normalizeType(manualMode), detail: chequeNo ? `#${chequeNo}` : '' };
  }

  const charge0 = txn?.chargeSnapshot?.charges?.data?.[0];
  const pmType = charge0?.payment_method_details?.type;
  if (pmType) {
    const last4 = charge0?.payment_method_details?.card?.last4 || '';
    const brand = charge0?.payment_method_details?.card?.brand || '';
    const detail = last4 ? `•••• ${last4}${brand ? ` (${brand})` : ''}` : (brand ? `(${brand})` : '');
    return { type: normalizeType(pmType), detail };
  }

  const altType = txn?.chargeSnapshot?.payment_method?.type || '';
  return { type: normalizeType(altType), detail: '' };
}

export function buildPaymentMap(
  transactions: any[],
  startMs: number,
  endMs: number
): Map<string, PaymentBucket> {
  const map = new Map<string, PaymentBucket>();

  for (const txn of transactions) {
    if (String(txn?.status || '').toLowerCase() !== 'succeeded') continue;
    const invoiceId = txn?.entityId || txn?.entitySource?.id || '';
    if (!invoiceId) continue;
    const ms = txnTimeMs(txn);
    if (ms === null || ms < startMs || ms >= endMs) continue;

    const { type, detail } = derivePayment(txn);
    if (!type) continue;

    if (!map.has(invoiceId)) {
      map.set(invoiceId, { types: new Set(), details: new Set(), latestMs: null, latestType: '', latestDetail: '' });
    }
    const bucket = map.get(invoiceId)!;
    bucket.types.add(type);
    if (detail) bucket.details.add(detail);
    if (bucket.latestMs === null || ms > bucket.latestMs) {
      bucket.latestMs = ms;
      bucket.latestType = type;
      bucket.latestDetail = detail;
    }
  }

  return map;
}

export function toPaymentTypeRows(
  invoices: Invoice[],
  paymentMap: Map<string, PaymentBucket>,
  timezone: string
): any[][] {
  return invoices.map(inv => {
    const p = paymentMap.get(inv.id || '');
    return [
      inv.id || '',
      inv.invoiceNumber || '',
      `${inv.invoiceNumberPrefix || 'INV-'}${inv.invoiceNumber || ''}`,
      inv.status || '',
      Number(inv.amountPaid || 0),
      Number(inv.amountDue || 0),
      Number(inv.total || 0),
      fmtDateMDY(inv.issueDate, timezone),
      fmtDateMDY(inv.dueDate, timezone),
      p?.latestType || '',
      p?.latestDetail || '',
      p?.latestMs ? fmtDateMDY(new Date(p.latestMs).toISOString(), timezone) : '',
      p ? Array.from(p.types).sort().join(' + ') : '',
      p ? Array.from(p.details).sort().join(' + ') : '',
    ];
  });
}
