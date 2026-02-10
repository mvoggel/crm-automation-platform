import { Request, Response, NextFunction } from 'express';
import { clientConfigLoader } from '../config/clientLoader';
import { ClientConfig } from '../types/config';

/**
 * Extended Express Request with client context
 */
export interface AuthenticatedRequest extends Request {
  clientConfig?: ClientConfig;
  clientId?: string;
}

/**
 * Auth middleware - validates API requests and loads client config
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Extract API secret from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        ok: false,
        error: 'unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      return;
    }

    const providedSecret = authHeader.replace('Bearer ', '').trim();

    if (!providedSecret) {
      res.status(401).json({
        ok: false,
        error: 'unauthorized',
        message: 'Empty API secret',
      });
      return;
    }

    // 2. Extract clientId from request
    const clientId = 
      req.body?.clientId || 
      req.query?.clientId || 
      req.headers['x-client-id'];

    if (!clientId || typeof clientId !== 'string') {
      res.status(400).json({
        ok: false,
        error: 'missing_client_id',
        message: 'clientId is required (in body, query, or x-client-id header)',
      });
      return;
    }

    // 3. Load client config
    const clientConfig = await clientConfigLoader.load(clientId);

    if (!clientConfig) {
      res.status(404).json({
        ok: false,
        error: 'client_not_found',
        message: `No configuration found for client: ${clientId}`,
      });
      return;
    }

    // 4. Verify secret matches THIS client's secret
    if (providedSecret !== clientConfig.apiSecret) {
      res.status(401).json({
        ok: false,
        error: 'unauthorized',
        message: 'Invalid API secret for this client',
      });
      return;
    }

    // 5. Success! Attach client context to request
    req.clientConfig = clientConfig;
    req.clientId = clientId;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      ok: false,
      error: 'internal_error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional: Skip auth for health check and other public endpoints
 */
export function skipAuthForPublicRoutes(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const publicPaths = ['/health', '/api/health', '/'];

  if (publicPaths.includes(req.path)) {
    next();
    return;
  }

  // Otherwise, apply auth
  authMiddleware(req as AuthenticatedRequest, res, next);
}