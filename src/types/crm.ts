/**
 * Standard invoice format - all CRMs must transform to this
 */
export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceNumberPrefix: string;
  status: string;
  amountPaid: number;
  amountDue: number;
  total: number;
  issueDate: string | null;
  dueDate: string | null;
  liveMode: boolean;
  altType: string;
  altId: string;
  companyId: string;
  contactDetails?: Contact;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phoneNo: string;
  ownerId?: string;
  ownerName?: string;
  address?: Address;
}

export interface Address {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface Appointment {
  id: string;
  title: string;
  startTime: string | number; // Can be ISO string or milliseconds
  status: string;
  contactId: string;
  contactName: string;
  userId: string;
}

export interface Owner {
  ownerId: string;
  ownerName: string;
}

/**
 * Standardized invoice row for output (Google Sheets, Excel, etc.)
 */
export interface InvoiceRow {
  invoice_id: string;
  invoice_number: string;
  invoice_display: string;
  invoice_status: string;
  amount_paid: number;
  amount_due: number;
  amount_total: number;
  issue_date: string;
  due_date: string;
  live_mode: string;
  alt_type: string;
  alt_id: string;
  company_id: string;
  contact_id: string;
  owner_id: string;
  owner_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_addr1: string;
  contact_city: string;
  contact_state: string;
  contact_postal: string;
}

export interface AppointmentRow {
  user_id: string;
  event_id: string;
  event_title: string;
  appt_date: string;
  status: string;
  contact_id: string;
  contact_name: string;
}

export interface Transaction {
  id: string;
  entityId: string;
  entitySource?: { id?: string };
  status: string;
  fulfilledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  chargeSnapshot?: any;
}

export interface PaymentTypeRow {
  invoice_id: string;
  invoice_number: string;
  invoice_display: string;
  invoice_status: string;
  amount_paid: number;
  amount_due: number;
  amount_total: number;
  issue_date: string;
  due_date: string;
  latest_payment_type: string;
  latest_payment_detail: string;
  latest_payment_date: string;
  all_payment_types: string;
  all_payment_details: string;
}