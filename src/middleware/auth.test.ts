import { Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from './auth';
import { clientConfigLoader } from '../config/clientLoader';
import { ClientConfig } from '../types/config';

// Mock the client config loader
jest.mock('../config/clientLoader', () => ({
  clientConfigLoader: {
    load: jest.fn(),
  },
}));

const mockClientConfigLoader = clientConfigLoader as jest.Mocked<typeof clientConfigLoader>;

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      headers: {},
      body: {},
      query: {},
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  const validClientConfig: ClientConfig = {
    clientId: 'test-client',
    clientName: 'Test Client',
    apiSecret: 'correct-secret',
    crm: {
      type: 'leadconnector',
      apiToken: 'test-token',
      locationId: 'test-location',
    },
    spreadsheetId: 'test-sheet',
    timezone: 'America/New_York',
    teamUserIds: [],
  };

  describe('Successful authentication', () => {
    it('authenticates valid request with clientId in body', async () => {
      mockReq.headers = { authorization: 'Bearer correct-secret' };
      mockReq.body = { clientId: 'test-client' };

      mockClientConfigLoader.load.mockResolvedValue(validClientConfig);

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockClientConfigLoader.load).toHaveBeenCalledWith('test-client');
      expect(mockReq.clientConfig).toEqual(validClientConfig);
      expect(mockReq.clientId).toBe('test-client');
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('accepts clientId from query params', async () => {
      mockReq.headers = { authorization: 'Bearer correct-secret' };
      mockReq.query = { clientId: 'test-client' };

      mockClientConfigLoader.load.mockResolvedValue(validClientConfig);

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.clientId).toBe('test-client');
    });

    it('accepts clientId from x-client-id header', async () => {
      mockReq.headers = {
        authorization: 'Bearer correct-secret',
        'x-client-id': 'test-client',
      };

      mockClientConfigLoader.load.mockResolvedValue(validClientConfig);

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.clientId).toBe('test-client');
    });
  });

  describe('Missing or invalid Authorization header', () => {
    it('rejects request without Authorization header', async () => {
      mockReq.body = { clientId: 'test-client' };

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        ok: false,
        error: 'unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('rejects request with malformed Authorization header', async () => {
      mockReq.headers = { authorization: 'InvalidFormat' };
      mockReq.body = { clientId: 'test-client' };

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('rejects request with empty Bearer token', async () => {
      mockReq.headers = { authorization: 'Bearer ' };
      mockReq.body = { clientId: 'test-client' };

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        ok: false,
        error: 'unauthorized',
        message: 'Empty API secret',
      });
    });
  });

  describe('Missing or invalid clientId', () => {
    it('rejects request without clientId', async () => {
      mockReq.headers = { authorization: 'Bearer some-secret' };
      // No clientId in body, query, or headers

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        ok: false,
        error: 'missing_client_id',
        message: 'clientId is required (in body, query, or x-client-id header)',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('rejects request with non-string clientId', async () => {
      mockReq.headers = { authorization: 'Bearer some-secret' };
      mockReq.body = { clientId: 12345 }; // Number instead of string

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('Client not found', () => {
    it('rejects request for non-existent client', async () => {
      mockReq.headers = { authorization: 'Bearer some-secret' };
      mockReq.body = { clientId: 'non-existent-client' };

      mockClientConfigLoader.load.mockResolvedValue(null);

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        ok: false,
        error: 'client_not_found',
        message: 'No configuration found for client: non-existent-client',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Invalid API secret', () => {
    it('rejects request with wrong secret', async () => {
      mockReq.headers = { authorization: 'Bearer wrong-secret' };
      mockReq.body = { clientId: 'test-client' };

      mockClientConfigLoader.load.mockResolvedValue(validClientConfig);

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        ok: false,
        error: 'unauthorized',
        message: 'Invalid API secret for this client',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('prevents Client A from using Client B secret', async () => {
      // Try to access test-client with a different secret
      mockReq.headers = { authorization: 'Bearer client-b-secret' };
      mockReq.body = { clientId: 'test-client' };

      mockClientConfigLoader.load.mockResolvedValue(validClientConfig);

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('handles loader errors gracefully', async () => {
      mockReq.headers = { authorization: 'Bearer some-secret' };
      mockReq.body = { clientId: 'test-client' };

      mockClientConfigLoader.load.mockRejectedValue(new Error('Database error'));

      await authMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        ok: false,
        error: 'internal_error',
        message: 'Authentication failed',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});