import { CRMConnector } from '../connectors/base';
import { Invoice, InvoiceRow } from '../types/crm';
import { fmtDateMDY } from '../utils/date';

/**
 * Fetches invoices from the CRM and transforms them to row format.
 * Owner identity is sourced directly from inv.sentBy / inv.sentFrom.fromName —
 * no secondary contact API lookups are needed.
 */
export class InvoiceService {
  constructor(private crm: CRMConnector) {}

  /**
   * Fetch invoices for a specific year
   */
  async fetchInvoicesForYear(year: number): Promise<Invoice[]> {
    const start = new Date(year, 0, 1, 0, 0, 0);
    const end = new Date(year + 1, 0, 1, 0, 0, 0);
    return await this.crm.fetchInvoices(start, end);
  }

  /**
   * Fetch invoices for a specific month
   */
  async fetchInvoicesForMonth(year: number, month: number): Promise<Invoice[]> {
    const start = new Date(year, month - 1, 1, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0);
    return await this.crm.fetchInvoices(start, end);
  }

  /**
   * Transform invoices to standardized row format for output.
   * Salesperson is resolved from inv.sentBy (user ID) and inv.sentFrom.fromName (display name)
   * which are already present on every invoice — no extra API calls required.
   */
  transformToRows(invoices: Invoice[], timezone: string = 'America/New_York'): InvoiceRow[] {
    return invoices.map(inv => this.invoiceToRow(inv, timezone));
  }

  /**
   * Transform a single invoice to row format
   */
  private invoiceToRow(inv: Invoice, timezone: string): InvoiceRow {
    const contact = inv.contactDetails || {} as any;
    const addr = contact.address || {};

    return {
      invoice_id:        inv.id || '',
      invoice_number:    inv.invoiceNumber || '',
      invoice_display:   `${inv.invoiceNumberPrefix || 'INV-'}${inv.invoiceNumber || ''}`,
      invoice_status:    inv.status || '',
      amount_paid:       Number(inv.amountPaid || 0),
      amount_due:        Number(inv.amountDue || 0),
      amount_total:      Number(inv.total || 0),
      issue_date:        fmtDateMDY(inv.issueDate, timezone),
      due_date:          fmtDateMDY(inv.dueDate, timezone),
      live_mode:         inv.liveMode ? 'true' : 'false',
      alt_type:          inv.altType || '',
      alt_id:            inv.altId || '',
      company_id:        inv.companyId || '',
      contact_id:        contact.id || '',
      sent_by_user_id:   inv.sentBy || '',
      sent_from_name:    inv.sentFrom?.fromName || '',
      contact_name:      contact.name || '',
      contact_email:     contact.email || '',
      contact_phone:     contact.phoneNo || '',
      contact_addr1:     addr.addressLine1 || '',
      contact_city:      addr.city || '',
      contact_state:     addr.state || '',
      contact_postal:    addr.postalCode || '',
    };
  }

  /**
   * Get standard invoice headers (matches InvoiceRow key order)
   */
  getHeaders(): string[] {
    return [
      'invoice_id',
      'invoice_number',
      'invoice_display',
      'invoice_status',
      'amount_paid',
      'amount_due',
      'amount_total',
      'issue_date',
      'due_date',
      'live_mode',
      'alt_type',
      'alt_id',
      'company_id',
      'contact_id',
      'sent_by_user_id',
      'sent_from_name',
      'contact_name',
      'contact_email',
      'contact_phone',
      'contact_addr1',
      'contact_city',
      'contact_state',
      'contact_postal',
    ];
  }
}
