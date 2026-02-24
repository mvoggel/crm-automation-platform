import { Invoice, Appointment, Contact, Transaction } from '../types/crm';

/**
 * Base class that all CRM connectors must extend
 * Ensures consistent interface across different CRMs
 */
export abstract class CRMConnector {
  protected config: any;

  constructor(config: any) {
    this.config = config;
  }

  /**
   * Fetch invoices within date range
   */
  abstract fetchInvoices(startDate: Date, endDate: Date): Promise<Invoice[]>;

  /**
   * Fetch appointments for specific user(s)
   */
  abstract fetchAppointments(
    userIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Appointment[]>;

  /**
   * Fetch contact details by ID
   */
  abstract fetchContact(contactId: string): Promise<Contact>;

  /**
   * Fetch transactions within date range. Returns [] by default (not all CRMs support this).
   */
  async fetchTransactions(_startDate: Date, _endDate: Date): Promise<Transaction[]> {
    return [];
  }

  /**
   * Verify CRM credentials work
   */
  abstract healthCheck(): Promise<boolean>;
}