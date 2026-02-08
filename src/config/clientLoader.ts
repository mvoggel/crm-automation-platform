import fs from 'fs';
import path from 'path';
import { ClientConfig } from '../types/config';

/**
 * Load client configuration from file system
 * Each client has their own config.json in clients/{clientId}/
 */
export class ClientConfigLoader {
  private configCache: Map<string, ClientConfig> = new Map();
  private readonly clientsDir: string;

  constructor(clientsDir?: string) {
    // Default to clients/ directory at project root
    this.clientsDir = clientsDir || path.join(__dirname, '../../clients');
  }

  /**
   * Load client config by ID
   * Uses cache to avoid repeated file reads
   */
  async load(clientId: string): Promise<ClientConfig | null> {
    // Sanitize clientId to prevent path traversal attacks
    const sanitizedId = this.sanitizeClientId(clientId);
    if (!sanitizedId) {
      console.error(`Invalid client ID: ${clientId}`);
      return null;
    }

    // Check cache first
    if (this.configCache.has(sanitizedId)) {
      return this.configCache.get(sanitizedId)!;
    }

    // Load from file
    const configPath = path.join(this.clientsDir, sanitizedId, 'config.json');

    if (!fs.existsSync(configPath)) {
      console.error(`Config not found for client: ${sanitizedId}`);
      return null;
    }

    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw) as ClientConfig;

      // Validate config
      const validationError = this.validateConfig(config);
      if (validationError) {
        console.error(`Invalid config for ${sanitizedId}: ${validationError}`);
        return null;
      }

      // Cache it
      this.configCache.set(sanitizedId, config);

      return config;
    } catch (error) {
      console.error(`Failed to load config for ${sanitizedId}:`, error);
      return null;
    }
  }

  /**
   * Reload client config (clears cache for that client)
   */
  async reload(clientId: string): Promise<ClientConfig | null> {
    const sanitizedId = this.sanitizeClientId(clientId);
    if (!sanitizedId) return null;

    this.configCache.delete(sanitizedId);
    return this.load(sanitizedId);
  }

  /**
   * Clear entire config cache
   */
  clearCache(): void {
    this.configCache.clear();
  }

  /**
   * List all available clients
   */
  listClients(): string[] {
    if (!fs.existsSync(this.clientsDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.clientsDir, { withFileTypes: true });
    
    return entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
      .map(entry => entry.name);
  }

  /**
   * Sanitize client ID to prevent path traversal attacks
   */
  private sanitizeClientId(clientId: string): string | null {
    // Only allow alphanumeric, hyphens, and underscores
    if (!/^[a-z0-9_-]+$/i.test(clientId)) {
      return null;
    }

    // Prevent directory traversal
    if (clientId.includes('..') || clientId.includes('/') || clientId.includes('\\')) {
      return null;
    }

    return clientId;
  }

  /**
   * Validate client config has required fields
   */
  private validateConfig(config: any): string | null {
    if (!config.clientId) return 'Missing clientId';
    if (!config.clientName) return 'Missing clientName';
    if (!config.apiSecret) return 'Missing apiSecret';
    if (!config.crm) return 'Missing crm config';
    if (!config.crm.type) return 'Missing crm.type';
    if (!config.spreadsheetId) return 'Missing spreadsheetId';
    if (!config.timezone) return 'Missing timezone';
    
    // Validate CRM-specific fields
    if (config.crm.type === 'leadconnector') {
      if (!config.crm.apiToken) return 'Missing crm.apiToken for LeadConnector';
      if (!config.crm.locationId) return 'Missing crm.locationId for LeadConnector';
    }

    return null; // Valid
  }
}

// Singleton instance
export const clientConfigLoader = new ClientConfigLoader();