// Express application: security headers, CORS for the two front ends, auth and data routes.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.mjs';
import { authRouter, authenticate } from './auth.mjs';
import { apiRouter, health } from './api.mjs';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || config.allowedOrigins.includes(origin)
      || (!config.allowedOrigins.length && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))),
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-upsert'],
    maxAge: 600,
  }));
  app.get('/health', (req, res, next) => health(req, res).catch(next));
  app.use(express.json({ limit: '5mb' }));
  app.use(authenticate);
  app.use('/auth', authRouter);
  app.use(apiRouter);
  app.use((req, res) => res.status(404).json({ message: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ message: 'The object exceeded the maximum allowed size' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' });
    console.error(err);
    res.status(500).json({ message: 'Unexpected server error' });
  });
  return app;
}
