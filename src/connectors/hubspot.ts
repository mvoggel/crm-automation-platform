/** HubSpot API client — stub implementation for contacts; starting point for a full HubSpot integration. */

import axios, { AxiosInstance } from 'axios';
import { CRMConnector } from './base';
import { Invoice, Contact, Appointment } from '../types/crm';

interface HubSpotConfig {
  apiToken: string;
}

export class HubSpotCRM extends CRMConnector {
  private client: AxiosInstance;
  private readonly BASE_URL = 'https://api.hubapi.com';

  constructor(config: HubSpotConfig) {
    super(config);
    
    if (!config.apiToken) {
      throw new Error('HubSpot requires apiToken');
    }
    
    this.client = axios.create({
      baseURL: this.BASE_URL,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch contacts (treating them as "invoices" for testing)
   * In a real scenario, you'd fetch actual deals/invoices
   */
  async fetchInvoices(startDate: Date, endDate: Date): Promise<Invoice[]> {
    try {
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();

      // HubSpot API: Get contacts with properties
      const response = await this.client.get('/crm/v3/objects/contacts', {
        params: {
          properties: 'firstname,lastname,email,phone,createdate,lifecyclestage,hubspot_owner_id',
          limit: 100,
        },
      });

      const contacts = response.data.results || [];

      // Filter by createdate and transform to "invoices"
      const invoices = contacts
        .filter((contact: any) => {
          if (!contact.properties.createdate) return false;
          const contactDate = new Date(contact.properties.createdate).getTime();
          return contactDate >= startMs && contactDate < endMs;
        })
        .map((contact: any) => this.normalizeContactAsInvoice(contact));

      return invoices;
    } catch (error: any) {
      throw new Error(`HubSpot API error: ${error.message}`);
    }
  }

  /**
   * Transform HubSpot contact to our Invoice format (for testing)
   */
  private normalizeContactAsInvoice(contact: any): Invoice {
    const props = contact.properties;
    const fullName = `${props.firstname || ''} ${props.lastname || ''}`.trim();
    
    return {
      id: contact.id,
      invoiceNumber: contact.id,
      invoiceNumberPrefix: 'CONTACT-',
      status: props.lifecyclestage || 'new',
      amountPaid: 0, // Contacts don't have amounts
      amountDue: 0,
      total: 0,
      issueDate: props.createdate || new Date().toISOString(),
      dueDate: props.createdate || new Date().toISOString(),
      liveMode: true,
      altType: 'contact',
      altId: contact.id,
      companyId: '',
      contactDetails: {
        id: contact.id,
        name: fullName || 'Unknown',
        email: props.email || '',
        phoneNo: props.phone || '',
        ownerId: props.hubspot_owner_id || '',
        ownerName: '', // Would need separate API call to get owner name
      },
    };
  }

  /**
   * Fetch contact by ID
   */
  async fetchContact(contactId: string): Promise<Contact> {
    try {
      const response = await this.client.get(`/crm/v3/objects/contacts/${contactId}`, {
        params: {
          properties: 'firstname,lastname,email,phone,hubspot_owner_id',
        },
      });

      const props = response.data.properties;
      
      return {
        id: response.data.id,
        name: `${props.firstname || ''} ${props.lastname || ''}`.trim(),
        email: props.email || '',
        phoneNo: props.phone || '',
        ownerId: props.hubspot_owner_id || '',
        ownerName: '', // Would need to fetch owner details separately
      };
    } catch (error: any) {
      throw new Error(`HubSpot contact fetch error: ${error.message}`);
    }
  }

  /**
   * HubSpot doesn't have appointments in free plan
   */
  async fetchAppointments(
    _userIds: string[],
    _startDate: Date,
    _endDate: Date
  ): Promise<Appointment[]> {
    // Return empty - would need Meetings API (paid feature)
    return [];
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/crm/v3/objects/contacts', {
        params: { limit: 1 },
      });
      return true;
    } catch {
      return false;
    }
  }
}