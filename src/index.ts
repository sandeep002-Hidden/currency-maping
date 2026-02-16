import dotenv from 'dotenv';

// Load environment variables FIRST, before importing config
dotenv.config();

import express, { Request, Response } from 'express';
import { config } from './config';
import { successResponse } from './utils';
import { v1Router } from './config';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', v1Router);
app.get('/', (req: Request, res: Response) => {
  res.json(successResponse('Welcome to the Currency Code Mapping API!', { time: new Date().toISOString() }));
});

app.get('/health', (req: Request, res: Response) => {
  res.json(successResponse('API is healthy', { time: new Date().toISOString() }));
});

app.listen(config.port, () => {
  console.log(`🚀 Server is running on http://localhost:${config.port}`);
});
