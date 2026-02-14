import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { skipAuthForPublicRoutes } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import syncRoutes from './routes/sync';  // ← Make sure this import is here

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(requestLogger);

// Public routes
app.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Apply auth to all /api routes
app.use(skipAuthForPublicRoutes);

// API routes - THIS LINE IS CRITICAL
app.use('/api', syncRoutes);  // ← Make sure this line exists

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔌 API endpoints: http://localhost:${PORT}/api/*`);
  });
}

export default app;