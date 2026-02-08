export interface CRMConfig {
  type: 'leadconnector' | 'servicetitan' | 'jobber' | 'spreadsheet';
  apiToken?: string;
  locationId?: string;
  apiVersion?: string;
  // ServiceTitan specific
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  // Spreadsheet specific
  spreadsheetId?: string;
  worksheetName?: string;
}

export interface ClientConfig {
  clientId: string;
  clientName: string;
  apiSecret: string;
  crm: CRMConfig;
  spreadsheetId: string;
  timezone: string;
  teamUserIds: string[];
  sheetNames?: {
    invoices?: string;
    appointments?: string;
  };
  customCalculations?: {
    commissionRate?: number;
    includeNonLiveInvoices?: boolean;
    [key: string]: any;
  };
}