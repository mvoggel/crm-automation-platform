import fs from 'fs';
import path from 'path';
import { ClientConfigLoader } from './clientLoader';
import { ClientConfig } from '../types/config';

// Mock the filesystem
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ClientConfigLoader', () => {
  let loader: ClientConfigLoader;
  const testClientsDir = '/test/clients';

  beforeEach(() => {
    jest.clearAllMocks();
    loader = new ClientConfigLoader(testClientsDir);
  });

  describe('load', () => {
    it('loads valid client config', async () => {
      const mockConfig: ClientConfig = {
        clientId: 'test-client',
        clientName: 'Test Client',
        apiSecret: 'test-secret',
        crm: {
          type: 'leadconnector',
          apiToken: 'test-token',
          locationId: 'test-location',
        },
        spreadsheetId: 'test-sheet-id',
        timezone: 'America/New_York',
        teamUserIds: ['user1', 'user2'],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = await loader.load('test-client');

      expect(result).toEqual(mockConfig);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(testClientsDir, 'test-client', 'config.json'),
        'utf-8'
      );
    });

    it('returns null for non-existent client', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await loader.load('non-existent');

      expect(result).toBeNull();
    });

    it('rejects invalid client ID (path traversal attempt)', async () => {
      const result = await loader.load('../../../etc/passwd');

      expect(result).toBeNull();
      expect(mockFs.existsSync).not.toHaveBeenCalled();
    });

    it('rejects client ID with slashes', async () => {
      const result = await loader.load('client/with/slashes');

      expect(result).toBeNull();
    });

    it('accepts valid client IDs with hyphens and underscores', async () => {
      const mockConfig: ClientConfig = {
        clientId: 'test-client_123',
        clientName: 'Test Client',
        apiSecret: 'secret',
        crm: { type: 'leadconnector', apiToken: 'token', locationId: 'loc' },
        spreadsheetId: 'sheet',
        timezone: 'America/New_York',
        teamUserIds: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = await loader.load('test-client_123');

      expect(result).not.toBeNull();
    });

    it('caches config after first load', async () => {
      const mockConfig: ClientConfig = {
        clientId: 'test-client',
        clientName: 'Test Client',
        apiSecret: 'secret',
        crm: { type: 'leadconnector', apiToken: 'token', locationId: 'loc' },
        spreadsheetId: 'sheet',
        timezone: 'America/New_York',
        teamUserIds: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // First load
      await loader.load('test-client');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);

      // Second load (should use cache)
      await loader.load('test-client');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1); // Still 1
    });

    it('validates required fields', async () => {
      const invalidConfig = {
        clientId: 'test',
        // Missing required fields
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      const result = await loader.load('test');

      expect(result).toBeNull();
    });

    it('validates LeadConnector-specific fields', async () => {
      const invalidConfig = {
        clientId: 'test',
        clientName: 'Test',
        apiSecret: 'secret',
        crm: {
          type: 'leadconnector',
          // Missing apiToken and locationId
        },
        spreadsheetId: 'sheet',
        timezone: 'America/New_York',
        teamUserIds: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      const result = await loader.load('test');

      expect(result).toBeNull();
    });
  });

  describe('reload', () => {
    it('clears cache and reloads config', async () => {
      const mockConfig: ClientConfig = {
        clientId: 'test-client',
        clientName: 'Test Client',
        apiSecret: 'secret',
        crm: { type: 'leadconnector', apiToken: 'token', locationId: 'loc' },
        spreadsheetId: 'sheet',
        timezone: 'America/New_York',
        teamUserIds: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // First load
      await loader.load('test-client');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);

      // Reload
      await loader.reload('test-client');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('listClients', () => {
  it('lists all client directories', () => {
    mockFs.existsSync.mockReturnValue(true);
    
    // Create proper mock Dirent objects
    const createMockDirent = (name: string, isDir: boolean): fs.Dirent => {
      return {
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSymbolicLink: () => false,
        isFIFO: () => false,
        isSocket: () => false,
      } as fs.Dirent;
    };

    (mockFs.readdirSync as jest.Mock).mockReturnValue([
      createMockDirent('client-a', true),
      createMockDirent('client-b', true),
      createMockDirent('_template', true), // Should be excluded
      createMockDirent('README.md', false), // Should be excluded
    ]);

    const clients = loader.listClients();

    expect(clients).toEqual(['client-a', 'client-b']);
  });

  it('returns empty array if clients dir does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    const clients = loader.listClients();

    expect(clients).toEqual([]);
  });
});

  describe('clearCache', () => {
    it('clears all cached configs', async () => {
      const mockConfig: ClientConfig = {
        clientId: 'test-client',
        clientName: 'Test Client',
        apiSecret: 'secret',
        crm: { type: 'leadconnector', apiToken: 'token', locationId: 'loc' },
        spreadsheetId: 'sheet',
        timezone: 'America/New_York',
        teamUserIds: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Load to populate cache
      await loader.load('test-client');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);

      // Clear cache
      loader.clearCache();

      // Load again (should read file again)
      await loader.load('test-client');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });
});