/** Logs method, path, status code, duration, and client ID for every request. */

import { Request, Response, NextFunction } from 'express';

/**
 * Simple request logger middleware
 * Logs method, path, and response time
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const clientId = (req as any).clientId || 'public';
    
    console.log(
      `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - client:${clientId}`
    );
  });

  next();
}