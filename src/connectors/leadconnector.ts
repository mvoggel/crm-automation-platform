/** LeadConnector / GoHighLevel API client — fetches invoices, appointments, transactions, and contacts. */

import axios, { AxiosInstance } from 'axios';
import { CRMConnector } from './base';
import { Invoice, Appointment, Contact, Owner, Transaction } from '../types/crm';
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

  async fetchInvoices(startDate: Date, endDate: Date): Promise<Invoice[]> {
    const all = await this.paginatedGet<any>('/invoices/', { altType: 'location', altId: this.locationId }, 'invoices');
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    return all
      .filter((raw: any) => {
        const t = raw.issueDate ? new Date(raw.issueDate).getTime() : null;
        return t !== null && t >= startMs && t < endMs;
      })
      .map((raw: any) => this.normalizeInvoice(raw));
  }

  private normalizeInvoice(raw: any): Invoice {
    return {
      id: raw._id || raw.id || '',
      invoiceNumber: raw.invoiceNumber || '',
      invoiceNumberPrefix: raw.invoiceNumberPrefix || 'INV-',
      status: raw.status || '',
      amountPaid: Number(raw.amountPaid || 0),
      amountDue: Number(raw.amountDue || 0),
      total: Number(raw.total || raw.amount || 0),
      issueDate: raw.issueDate || null,
      dueDate: raw.dueDate || null,
      liveMode: raw.liveMode === true,
      altType: raw.altType || '',
      altId: raw.altId || '',
      companyId: raw.companyId || '',
      contactDetails: raw.contactDetails,
    };
  }

  async fetchTransactions(startDate: Date, endDate: Date): Promise<Transaction[]> {
    const all = await this.paginatedGet<any>('/payments/transactions', { altType: 'location', altId: this.locationId }, 'transactions', 150);
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    return all.filter(txn => {
      const ms = txnTimeMs(txn);
      return ms !== null && ms >= startMs && ms < endMs;
    });
  }

  async fetchAppointments(userIds: string[], startDate: Date, endDate: Date): Promise<Appointment[]> {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const all: Appointment[] = [];

    for (const userId of userIds) {
      const path = `/calendars/events?locationId=${encodeURIComponent(this.locationId)}&userId=${encodeURIComponent(userId)}&startTime=${encodeURIComponent(String(startMs))}&endTime=${encodeURIComponent(String(endMs))}`;
      const response = await this.client.get(path);
      const events = response.data?.events || response.data?.data || [];
      if (events.length > 0) {
        console.log('[DEBUG appt] first event keys:', Object.keys(events[0]));
        console.log('[DEBUG appt] first event:', JSON.stringify(events[0]).substring(0, 600));
      }
      all.push(...events.map((evt: any) => this.normalizeAppointment(evt, userId)));
      await this.sleep(150);
    }

    // GHL calendar events often omit contactName — backfill via contact lookup when missing.
    // fetchContact has a 6-hour cache, so repeated contacts don't cause extra API calls.
    for (const apt of all) {
      if (!apt.contactName && apt.contactId) {
        try {
          const contact = await this.fetchContact(apt.contactId);
          apt.contactName = contact.name;
        } catch {
          // leave contactName empty if lookup fails
        }
      }
    }

    return all;
  }

  async fetchContact(contactId: string): Promise<Contact> {
    const cacheKey = `lc:contact:${contactId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached as Contact;

    const response = await this.client.get(`/contacts/${encodeURIComponent(contactId)}`);
    const raw = response.data?.contact || response.data;
    const owner = this.extractOwner(raw);

    const contact: Contact = {
      id: raw.id || '',
      name: raw.name || `${raw.firstName || ''} ${raw.lastName || ''}`.trim(),
      email: raw.email || '',
      phoneNo: raw.phone || raw.phoneNo || '',
      ownerId: owner.ownerId,
      ownerName: owner.ownerName,
      address: raw.address,
    };

    cache.set(cacheKey, contact, 21600);
    return contact;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get(`/locations/${this.locationId}`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  private extractOwner(c: any): Owner {
    return {
      ownerId: c?.ownerId || c?.owner?.id || c?.assignedTo || c?.assignedToId || '',
      ownerName: c?.ownerName || c?.owner?.name || c?.assignedToName || '',
    };
  }

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

  private async paginatedGet<T>(
    path: string,
    params: Record<string, string>,
    dataKey: string,
    sleepMs = 250
  ): Promise<T[]> {
    const limit = 100;
    let offset = 0;
    const all: T[] = [];
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const separator = path.includes('?') ? '&' : '?';

    while (true) {
      const response = await this.client.get(`${path}${separator}${qs}&limit=${limit}&offset=${offset}`);
      const items: T[] = response.data?.[dataKey] || response.data?.data || response.data?.items || [];
      all.push(...items);
      if (items.length < limit) break;
      offset += limit;
      await this.sleep(sleepMs);
    }

    return all;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

function txnTimeMs(txn: any): number | null {
  const v = txn?.fulfilledAt || txn?.createdAt || txn?.updatedAt || '';
  if (!v) return null;
  const ms = new Date(v).getTime();
  return isNaN(ms) ? null : ms;
}
