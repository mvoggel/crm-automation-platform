import { InvoiceService } from './invoiceService';
import { CRMConnector } from '../connectors/base';
import { Invoice, Contact, Appointment, Owner } from '../types/crm';

// Mock CRM connector for testing
class MockCRM extends CRMConnector {
  private mockInvoices: Invoice[] = [];
  private mockContacts: Map<string, Contact> = new Map();

  setMockInvoices(invoices: Invoice[]) {
    this.mockInvoices = invoices;
  }

  setMockContact(contactId: string, contact: Contact) {
    this.mockContacts.set(contactId, contact);
  }

  async fetchInvoices(startDate: Date, endDate: Date): Promise<Invoice[]> {
    // Filter mock invoices by date range
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    return this.mockInvoices.filter(inv => {
      const issueMs = inv.issueDate ? new Date(inv.issueDate).getTime() : 0;
      return issueMs >= startMs && issueMs < endMs;
    });
  }

  async fetchAppointments(): Promise<Appointment[]> {
    return [];
  }

  async fetchContact(contactId: string): Promise<Contact> {
    const contact = this.mockContacts.get(contactId);
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }
    return contact;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('InvoiceService', () => {
  let service: InvoiceService;
  let mockCRM: MockCRM;

  beforeEach(() => {
    mockCRM = new MockCRM({});
    service = new InvoiceService(mockCRM);
  });

  describe('fetchInvoicesForYear', () => {
    it('fetches invoices within year boundaries', async () => {
      const mockInvoices: Invoice[] = [
        createMockInvoice('inv-1', '2024-03-15T10:00:00Z'),
        createMockInvoice('inv-2', '2024-06-20T10:00:00Z'),
        createMockInvoice('inv-3', '2023-12-31T10:00:00Z'), // Should be excluded
        createMockInvoice('inv-4', '2025-01-01T10:00:00Z'), // Should be excluded
      ];

      mockCRM.setMockInvoices(mockInvoices);

      const result = await service.fetchInvoicesForYear(2024);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('inv-1');
      expect(result[1].id).toBe('inv-2');
    });
  });

  describe('fetchInvoicesForMonth', () => {
    it('fetches invoices within month boundaries', async () => {
      const mockInvoices: Invoice[] = [
        createMockInvoice('inv-1', '2024-03-01T10:00:00Z'),
        createMockInvoice('inv-2', '2024-03-15T10:00:00Z'),
        createMockInvoice('inv-3', '2024-03-31T23:59:59Z'),
        createMockInvoice('inv-4', '2024-02-28T10:00:00Z'), // Should be excluded
        createMockInvoice('inv-5', '2024-04-01T10:00:00Z'), // Should be excluded
      ];

      mockCRM.setMockInvoices(mockInvoices);

      const result = await service.fetchInvoicesForMonth(2024, 3);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('inv-1');
      expect(result[1].id).toBe('inv-2');
      expect(result[2].id).toBe('inv-3');
    });
  });

  describe('buildOwnerLookup', () => {
    it('creates owner map from invoice contacts', async () => {
      const invoices: Invoice[] = [
        createMockInvoiceWithContact('inv-1', 'contact-1'),
        createMockInvoiceWithContact('inv-2', 'contact-2'),
        createMockInvoiceWithContact('inv-3', 'contact-1'), // Duplicate contact
      ];

      mockCRM.setMockContact('contact-1', {
        id: 'contact-1',
        name: 'John Doe',
        email: 'john@example.com',
        phoneNo: '555-0001',
        ownerId: 'owner-1',
        ownerName: 'Sales Rep A',
      });

      mockCRM.setMockContact('contact-2', {
        id: 'contact-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        phoneNo: '555-0002',
        ownerId: 'owner-2',
        ownerName: 'Sales Rep B',
      });

      const ownerMap = await service.buildOwnerLookup(invoices);

      expect(ownerMap.size).toBe(2);
      expect(ownerMap.get('contact-1')).toEqual({
        ownerId: 'owner-1',
        ownerName: 'Sales Rep A',
      });
      expect(ownerMap.get('contact-2')).toEqual({
        ownerId: 'owner-2',
        ownerName: 'Sales Rep B',
      });
    });

    it('handles contacts without owner info', async () => {
      const invoices: Invoice[] = [
        createMockInvoiceWithContact('inv-1', 'contact-1'),
      ];

      mockCRM.setMockContact('contact-1', {
        id: 'contact-1',
        name: 'John Doe',
        email: 'john@example.com',
        phoneNo: '555-0001',
        // No ownerId or ownerName
      });

      const ownerMap = await service.buildOwnerLookup(invoices);

      expect(ownerMap.get('contact-1')).toEqual({
        ownerId: '',
        ownerName: '',
      });
    });
  });

  describe('transformToRows', () => {
    it('transforms invoices to row format', () => {
      const invoices: Invoice[] = [
        {
          id: 'inv-123',
          invoiceNumber: '001',
          invoiceNumberPrefix: 'INV-',
          status: 'paid',
          amountPaid: 1000,
          amountDue: 0,
          total: 1000,
          issueDate: '2024-01-15T00:00:00Z',
          dueDate: '2024-02-15T00:00:00Z',
          liveMode: true,
          altType: 'location',
          altId: 'loc-1',
          companyId: 'comp-1',
          contactDetails: {
            id: 'contact-1',
            name: 'John Doe',
            email: 'john@example.com',
            phoneNo: '555-1234',
            address: {
              addressLine1: '123 Main St',
              city: 'Anytown',
              state: 'NJ',
              postalCode: '08001',
            },
          },
        },
      ];

      const ownerMap = new Map<string, Owner>([
        ['contact-1', { ownerId: 'owner-1', ownerName: 'Sales Rep' }],
      ]);

      const rows = service.transformToRows(invoices, ownerMap);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        invoice_id: 'inv-123',
        invoice_number: '001',
        invoice_display: 'INV-001',
        invoice_status: 'paid',
        amount_paid: 1000,
        amount_due: 0,
        amount_total: 1000,
        issue_date: '01/15/2024',
        due_date: '02/15/2024',
        live_mode: 'true',
        alt_type: 'location',
        alt_id: 'loc-1',
        company_id: 'comp-1',
        contact_id: 'contact-1',
        owner_id: 'owner-1',
        owner_name: 'Sales Rep',
        contact_name: 'John Doe',
        contact_email: 'john@example.com',
        contact_phone: '555-1234',
        contact_addr1: '123 Main St',
        contact_city: 'Anytown',
        contact_state: 'NJ',
        contact_postal: '08001',
      });
    });
  });

  describe('getHeaders', () => {
    it('returns correct header array', () => {
      const headers = service.getHeaders();

      expect(headers).toContain('invoice_id');
      expect(headers).toContain('owner_name');
      expect(headers).toContain('contact_city');
      expect(headers).toHaveLength(23);
    });
  });

  describe('fetchAndTransformInvoices', () => {
    it('performs complete workflow for monthly data', async () => {
      const mockInvoices: Invoice[] = [
        createMockInvoiceWithContact('inv-1', 'contact-1', '2024-03-15T10:00:00Z'),
      ];

      mockCRM.setMockInvoices(mockInvoices);
      mockCRM.setMockContact('contact-1', {
        id: 'contact-1',
        name: 'John Doe',
        email: 'john@example.com',
        phoneNo: '555-0001',
        ownerId: 'owner-1',
        ownerName: 'Sales Rep',
      });

      const result = await service.fetchAndTransformInvoices(2024, 3);

      expect(result.headers).toHaveLength(23);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].invoice_id).toBe('inv-1');
      expect(result.rows[0].owner_name).toBe('Sales Rep');
    });

    it('performs complete workflow for yearly data', async () => {
      const mockInvoices: Invoice[] = [
        createMockInvoiceWithContact('inv-1', 'contact-1', '2024-01-15T10:00:00Z'),
        createMockInvoiceWithContact('inv-2', 'contact-1', '2024-06-15T10:00:00Z'),
      ];

      mockCRM.setMockInvoices(mockInvoices);
      mockCRM.setMockContact('contact-1', {
        id: 'contact-1',
        name: 'John Doe',
        email: 'john@example.com',
        phoneNo: '555-0001',
        ownerId: 'owner-1',
        ownerName: 'Sales Rep',
      });

      const result = await service.fetchAndTransformInvoices(2024);

      expect(result.headers).toHaveLength(23);
      expect(result.rows).toHaveLength(2);
    });
  });
});

// Helper functions to create mock data
function createMockInvoice(id: string, issueDate: string): Invoice {
  return {
    id,
    invoiceNumber: id.replace('inv-', ''),
    invoiceNumberPrefix: 'INV-',
    status: 'paid',
    amountPaid: 1000,
    amountDue: 0,
    total: 1000,
    issueDate,
    dueDate: issueDate,
    liveMode: true,
    altType: 'location',
    altId: 'loc-1',
    companyId: 'comp-1',
  };
}

function createMockInvoiceWithContact(
  id: string,
  contactId: string,
  issueDate: string = '2024-01-15T10:00:00Z'
): Invoice {
  return {
    ...createMockInvoice(id, issueDate),
    contactDetails: {
      id: contactId,
      name: 'Test Contact',
      email: 'test@example.com',
      phoneNo: '555-0000',
    },
  };
}