import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { skipAuthForPublicRoutes } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import invoiceRoutes from './routes/invoices';
import appointmentRoutes from './routes/appointments';
import paymentRoutes from './routes/payments';
import statusRoutes from './routes/status';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(requestLogger);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' });
});

app.use(skipAuthForPublicRoutes);

app.use('/api', invoiceRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', paymentRoutes);
app.use('/api', statusRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
