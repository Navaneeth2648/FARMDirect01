import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.ts';
import { getDb, q } from './db/index.ts';
import { errorHandler, HttpError } from './lib/http.ts';
import { loadUser, requireAuth } from './lib/auth.ts';
import { securityHeaders, sameOriginWrites, rateLimit } from './lib/security.ts';
import { authRouter } from './routes/auth.ts';
import { meRouter } from './routes/me.ts';
import { farmsRouter, cyclesRouter, tasksRouter, recordsRouter, financeRouter } from './routes/farms.ts';
import { weatherRouter } from './routes/weather.ts';
import { cropsRouter, advisoryRouter } from './routes/advisory.ts';
import { marketRouter } from './routes/market.ts';
import { diagnosisRouter } from './routes/diagnosis.ts';
import { assistantRouter } from './routes/assistant.ts';
import { alertsRouter, notificationsRouter } from './routes/alerts.ts';
import { contentRouter, schemesRouter } from './routes/content.ts';
import { productsRouter, verifyRouter, providersRouter } from './routes/products.ts';
import { communityRouter, moderationRouter } from './routes/community.ts';
import { casesRouter, expertRouter } from './routes/expert.ts';
import { adminRouter } from './routes/admin.ts';
import { dashboardRouter, satelliteRouter } from './routes/dashboard.ts';
import { buyerRouter, documentsRouter, trustRouter, verificationRouter } from './routes/verification.ts';
import { marketplaceRouter } from './routes/marketplace.ts';
import { offersRouter, ordersRouter } from './routes/orders.ts';
import { storageRouter, providerRouter } from './routes/storage.ts';
import { transportRouter } from './routes/transport.ts';
import { paymentsRouter, webhooksRouter } from './routes/payments.ts';
import { disputesRouter, disputeOfficerRouter } from './routes/disputes.ts';
import { opsRouter } from './routes/ops.ts';
import { gradingRouter } from './routes/grading.ts';
import { guidesRouter, statisticsRouter, ecropRouter } from './routes/data.ts';
import { directoryRouter, inputsRouter } from './routes/commerce.ts';

export function createApp() {
  getDb();
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders);
  // Keep the raw body so signed webhooks can be verified byte-for-byte.
  app.use(express.json({ limit: '200kb', verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; } }));

  const api = express.Router();
  api.use(loadUser);
  api.use(sameOriginWrites);
  api.use(rateLimit({ name: 'global', windowMs: 60_000, max: 300 }));

  api.get('/health', (_req, res) => {
    let db = 'ok';
    try { q.get('SELECT 1'); } catch { db = 'error'; }
    res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', db, demo: config.demoMode, time: new Date().toISOString() });
  });

  api.use('/auth', authRouter);
  api.use('/webhooks', webhooksRouter); // signature-verified, no session
  // Everything below requires a signed-in user.
  api.use(requireAuth);
  api.use('/v1/buyer', buyerRouter);
  api.use('/v1/verification', verificationRouter);
  api.use('/v1/documents', documentsRouter);
  api.use('/v1/trust', trustRouter);
  api.use('/v1/marketplace', marketplaceRouter);
  api.use('/v1/offers', offersRouter);
  api.use('/v1/orders', ordersRouter);
  api.use('/v1/storage/provider', providerRouter);
  api.use('/v1/storage', storageRouter);
  api.use('/v1/transport', transportRouter);
  api.use('/v1/payments', paymentsRouter);
  api.use('/v1/disputes', disputesRouter);
  api.use('/v1/ops/disputes', disputeOfficerRouter);
  api.use('/v1/ops', opsRouter);
  api.use('/v1/grading', gradingRouter);
  api.use('/v1/guides', guidesRouter);
  api.use('/v1/statistics', statisticsRouter);
  api.use('/v1/ecrop', ecropRouter);
  api.use('/v1/businesses', directoryRouter);
  api.use('/v1/inputs', inputsRouter);
  api.use('/v1/me', meRouter);
  api.use('/v1/dashboard', dashboardRouter);
  api.use('/v1/farms', farmsRouter);
  api.use('/v1/cycles', cyclesRouter);
  api.use('/v1/tasks', tasksRouter);
  api.use('/v1/records', recordsRouter);
  api.use('/v1/finance', financeRouter);
  api.use('/v1/weather', weatherRouter);
  api.use('/v1/crops', cropsRouter);
  api.use('/v1/advisory', advisoryRouter);
  api.use('/v1/market', marketRouter);
  api.use('/v1/diagnosis', diagnosisRouter);
  api.use('/v1/assistant', assistantRouter);
  api.use('/v1/alerts', alertsRouter);
  api.use('/v1/notifications', notificationsRouter);
  api.use('/v1/content', contentRouter);
  api.use('/v1/schemes', schemesRouter);
  api.use('/v1/products', productsRouter);
  api.use('/v1/verify', verifyRouter);
  api.use('/v1/providers', providersRouter);
  api.use('/v1/community', communityRouter);
  api.use('/v1/moderation', moderationRouter);
  api.use('/v1/cases', casesRouter);
  api.use('/v1/expert', expertRouter);
  api.use('/v1/admin', adminRouter);
  api.use('/v1/satellite', satelliteRouter);
  api.use((_req, _res, next) => next(new HttpError(404, 'API route not found', 'not_found')));

  app.use('/api', api);

  // Serve the built SPA in production.
  const dist = path.resolve('dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '7d', setHeaders: (res, p) => { if (p.endsWith('.html') || p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); } }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
