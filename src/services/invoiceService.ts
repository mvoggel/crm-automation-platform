import { CRMConnector } from '../connectors/base';
import { Invoice, Owner, InvoiceRow } from '../types/crm';
import { fmtDateMDY } from '../utils/date';

/**
 * Invoice service - handles fetching, transforming, and enriching invoice data
 * Works with any CRM connector that implements the CRMConnector interface
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
   * Build owner lookup map for all unique contacts in invoice list
   * Uses caching from CRM connector to avoid redundant API calls
   */
  async buildOwnerLookup(invoices: Invoice[]): Promise<Map<string, Owner>> {
    const ownerMap = new Map<string, Owner>();
    
    // Get unique contact IDs
    const contactIds = new Set<string>();
    invoices.forEach(inv => {
      const cid = inv.contactDetails?.id;
      if (cid) contactIds.add(cid);
    });

    console.log(`Building owner lookup for ${contactIds.size} unique contacts...`);

    // Fetch owner info for each contact (with rate limiting)
    let count = 0;
    for (const contactId of contactIds) {
      try {
        // Rate limiting: pause every 25 requests
        if (count > 0 && count % 25 === 0) {
          await this.sleep(250);
        }

        const contact = await this.crm.fetchContact(contactId);
        
        // DEBUG: Log first contact to see what we get
        if (count === 0) {
          console.log('Sample contact data:', JSON.stringify(contact, null, 2));
        }
        
        ownerMap.set(contactId, {
          ownerId: contact.ownerId || '',
          ownerName: contact.ownerName || '',
        });

        count++;
      } catch (error) {
        console.error(`Failed to fetch contact ${contactId}:`, error);
        // Set empty owner on error
        ownerMap.set(contactId, { ownerId: '', ownerName: '' });
      }
    }

    console.log(`Owner lookup complete. Found owners for ${Array.from(ownerMap.values()).filter(o => o.ownerId).length} contacts`);

    return ownerMap;
  }

  /**
   * Transform invoices to standardized row format for output
   */
  transformToRows(
    invoices: Invoice[],
    ownerMap: Map<string, Owner>,
    timezone: string = 'America/New_York'
  ): InvoiceRow[] {
    return invoices.map(inv => this.invoiceToRow(inv, ownerMap, timezone));
  }

  /**
   * Transform single invoice to row format
   */
  private invoiceToRow(
    inv: Invoice,
    ownerMap: Map<string, Owner>,
    timezone: string
  ): InvoiceRow {
    const contact = inv.contactDetails || {} as any;
    const addr = contact.address || {};
    
    const owner = contact.id && ownerMap.has(contact.id)
      ? ownerMap.get(contact.id)!
      : { ownerId: '', ownerName: '' };

    return {
      invoice_id: inv.id || '',
      invoice_number: inv.invoiceNumber || '',
      invoice_display: `${inv.invoiceNumberPrefix || 'INV-'}${inv.invoiceNumber || ''}`,
      invoice_status: inv.status || '',
      amount_paid: Number(inv.amountPaid || 0),
      amount_due: Number(inv.amountDue || 0),
      amount_total: Number(inv.total || 0),
      issue_date: fmtDateMDY(inv.issueDate, timezone),
      due_date: fmtDateMDY(inv.dueDate, timezone),
      live_mode: inv.liveMode ? 'true' : 'false',
      alt_type: inv.altType || '',
      alt_id: inv.altId || '',
      company_id: inv.companyId || '',
      contact_id: contact.id || '',
      owner_id: owner.ownerId,
      owner_name: owner.ownerName,
      contact_name: contact.name || '',
      contact_email: contact.email || '',
      contact_phone: contact.phoneNo || '',
      contact_addr1: addr.addressLine1 || '',
      contact_city: addr.city || '',
      contact_state: addr.state || '',
      contact_postal: addr.postalCode || '',
    };
  }

  /**
   * Get standard invoice headers
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
      'owner_id',
      'owner_name',
      'contact_name',
      'contact_email',
      'contact_phone',
      'contact_addr1',
      'contact_city',
      'contact_state',
      'contact_postal',
    ];
  }

  /**
   * Complete workflow: fetch invoices, enrich with owners, transform to rows
   */
  async fetchAndTransformInvoices(
    year: number,
    month?: number,
    timezone: string = 'America/New_York'
  ): Promise<{ headers: string[], rows: InvoiceRow[] }> {
    // Fetch invoices
    const invoices = month
      ? await this.fetchInvoicesForMonth(year, month)
      : await this.fetchInvoicesForYear(year);

    // Enrich with owner data
    const ownerMap = await this.buildOwnerLookup(invoices);

    // Transform to rows
    const rows = this.transformToRows(invoices, ownerMap, timezone);

    return {
      headers: this.getHeaders(),
      rows,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}