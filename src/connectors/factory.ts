import { CRMConnector } from './base';
import { LeadConnectorCRM } from './leadconnector';
import { CRMConfig } from '../types/config';

/**
 * Factory to create appropriate CRM connector based on config
 * Supports multiple CRM types + "no CRM" scenario
 */
export function createCRMConnector(config: CRMConfig): CRMConnector {
  switch (config.type) {
    case 'leadconnector':
      if (!config.apiToken || !config.locationId) {
        throw new Error('LeadConnector requires apiToken and locationId');
      }
      return new LeadConnectorCRM({
        apiToken: config.apiToken,
        locationId: config.locationId,
        apiVersion: config.apiVersion,
      });

    case 'spreadsheet':
      // Client doesn't have a CRM yet - they just use spreadsheets
      throw new Error('Spreadsheet-only mode: Use manual data entry endpoints instead of CRM sync');

    case 'servicetitan':
      // Future: ServiceTitan connector
      throw new Error('ServiceTitan connector not yet implemented');

    case 'jobber':
      // Future: Jobber connector
      throw new Error('Jobber connector not yet implemented');

    default:
      throw new Error(`Unsupported CRM type: ${config.type}`);
  }
}

/**
 * Check if client has a CRM configured
 */
export function hasCRM(config: CRMConfig): boolean {
  return config.type !== 'spreadsheet';
}