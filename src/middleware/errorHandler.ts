import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware
 * Catches any errors thrown in route handlers
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Unhandled error:', error);

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    ok: false,
    error: 'internal_server_error',
    message: isDevelopment ? error.message : 'An unexpected error occurred',
    ...(isDevelopment && { stack: error.stack }),
  });
}

/**
 * 404 handler for unknown routes
 */
export function notFoundHandler(
  req: Request,
  res: Response
): void {
  res.status(404).json({
    ok: false,
    error: 'not_found',
    message: `Route not found: ${req.method} ${req.path}`,
  });
}