import express from 'express';
import cors from 'cors';
import { supabase } from './lib/supabase';
import logger from './lib/logger';
import userRoutes from './routes/userRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', userRoutes);

app.get('/health', async (_req, res) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      logger.error({ err: error }, 'Duomenų bazės ryšys nepasiekiamas');
      res.status(503).json({
        status: 'error',
        message: 'Duomenų bazės ryšys nepasiekiamas',
        details: error.message,
      });
      return;
    }

    logger.info('DB health check sėkmingas');
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nežinoma klaida';
    logger.error({ err }, 'Duomenų bazės ryšio klaida');
    res.status(503).json({
      status: 'error',
      message: 'Duomenų bazės ryšys nepasiekiamas',
      details: message,
    });
  }
});

export default app;
