import axios, { AxiosInstance } from 'axios';
import { CRMConnector } from './base';
import { Invoice, Appointment, Contact, Owner } from '../types/crm';
import { cache } from '../utils/cache';

export interface LeadConnectorConfig {
  apiToken: string;
  locationId: string;
  apiVersion?: string;
}

export class LeadConnectorCRM extends CRMConnector {
  private client: AxiosInstance;
  private readonly BASE_URL = 'https://services.leadconnectorhq.com';
  private readonly API_VERSION: string;
  private readonly locationId: string;

  constructor(config: LeadConnectorConfig) {
    super(config);

    this.locationId = config.locationId;
    this.API_VERSION = config.apiVersion || '2021-07-28';

    this.client = axios.create({
      baseURL: this.BASE_URL,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Version': this.API_VERSION,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Fetch all invoices with pagination, then filter by date
   */
  async fetchInvoices(startDate: Date, endDate: Date): Promise<Invoice[]> {
    const allInvoices = await this.fetchAllInvoicesPaged();

    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    return allInvoices.filter(inv => {
      const issueTime = inv.issueDate ? new Date(inv.issueDate).getTime() : null;
      return issueTime !== null && issueTime >= startMs && issueTime < endMs;
    });
  }

  /**
   * Paginated fetch of all invoices (LeadConnector supports limit/offset)
   */
  private async fetchAllInvoicesPaged(): Promise<Invoice[]> {
    const limit = 100;
    let offset = 0;
    const all: Invoice[] = [];

    while (true) {
      const path = `/invoices/?altType=location&altId=${encodeURIComponent(this.locationId)}&limit=${limit}&offset=${offset}`;

      try {
        const response = await this.client.get(path);
        const invoices = response.data?.invoices || [];

        all.push(...invoices);

        if (invoices.length < limit) break;
        offset += limit;

        // Rate limiting pause
        await this.sleep(250);
      } catch (error: any) {
        throw new Error(`LeadConnector API error: ${error.message}`);
      }
    }

    return all;
  }

  /**
   * Fetch appointments (calendar events) for multiple users
   */
  async fetchAppointments(
    userIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Appointment[]> {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    const allAppointments: Appointment[] = [];

    for (const userId of userIds) {
      const events = await this.fetchCalendarEventsForUser(userId, startMs, endMs);
      allAppointments.push(...events);

      // Small pause between users
      await this.sleep(150);
    }

    return allAppointments;
  }

  /**
   * Fetch calendar events for a single user
   * Note: LeadConnector API may not support limit/offset for this endpoint
   */
  private async fetchCalendarEventsForUser(
    userId: string,
    startMs: number,
    endMs: number
  ): Promise<Appointment[]> {
    const path = `/calendars/events?locationId=${encodeURIComponent(this.locationId)}&userId=${encodeURIComponent(userId)}&startTime=${encodeURIComponent(String(startMs))}&endTime=${encodeURIComponent(String(endMs))}`;

    try {
      const response = await this.client.get(path);
      const events = response.data?.events || response.data?.data || [];

      return events.map((evt: any) => this.normalizeAppointment(evt, userId));
    } catch (error: any) {
      throw new Error(`LeadConnector calendar API error: ${error.message}`);
    }
  }

    /**
     * Fetch contact by ID
     */
    /**
   * Fetch contact by ID
   */
  async fetchContact(contactId: string): Promise<Contact> {
    const path = `/contacts/${encodeURIComponent(contactId)}`;

    try {
      const response = await this.client.get(path);
      const rawContact = response.data?.contact || response.data;
      
      // Extract owner info from the contact
      const owner = this.extractOwner(rawContact);
      
      return {
        id: rawContact.id || '',
        name: rawContact.name || rawContact.firstName + ' ' + rawContact.lastName || '',
        email: rawContact.email || '',
        phoneNo: rawContact.phone || rawContact.phoneNo || '',
        ownerId: owner.ownerId,
        ownerName: owner.ownerName,
        address: rawContact.address,
      };
    } catch (error: any) {
      throw new Error(`LeadConnector contact fetch error: ${error.message}`);
    }
  }

  /**
   * Extract owner from contact data (handles various field names)
   */
  private extractOwner(contactPayload: any): Owner {
    const c = contactPayload?.contact || contactPayload;

    const ownerId =
      c?.ownerId ||
      c?.owner?.id ||
      c?.assignedTo ||
      c?.assignedToId ||
      '';

    const ownerName =
      c?.ownerName ||
      c?.owner?.name ||
      c?.assignedToName ||
      '';

    return { ownerId, ownerName };
  }

  /**
   * Extract owner info from contact payload (with caching)
   */
  async getOwnerByContactId(contactId: string): Promise<Owner> {
    const cacheKey = `lc:owner:${contactId}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return cached as Owner;
    }

    const contact = await this.fetchContact(contactId);
    const owner = this.extractOwner(contact);

    // Cache for 6 hours (21600 seconds)
    cache.set(cacheKey, owner, 21600);

    return owner;
  }


  /**
   * Normalize LeadConnector appointment to standard format
   */
  private normalizeAppointment(evt: any, userId: string): Appointment {
    return {
      id: evt?.id || evt?._id || '',
      userId,
      title: evt?.title || evt?.calendarTitle || evt?.name || '',
      startTime: evt?.startTime || evt?.start || evt?.start_time || '',
      status: evt?.status || evt?.appointmentStatus || '',
      contactId: evt?.contactId || evt?.contact_id || evt?.contact?.id || '',
      contactName: evt?.contactName || evt?.contact_name || evt?.contact?.name || '',
    };
  }

  /**
   * Health check - verify credentials
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get(`/locations/${this.locationId}`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}