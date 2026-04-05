import express from 'express';
import cors from 'cors';
import { supabase } from './lib/supabase';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    const { error } = await supabase
      .from('_health_check')
      .select('*')
      .limit(1);

    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      res.status(503).json({
        status: 'error',
        message: 'Duomenų bazės ryšys nepasiekiamas',
        details: error.message,
      });
      return;
    }

    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nežinoma klaida';
    res.status(503).json({
      status: 'error',
      message: 'Duomenų bazės ryšys nepasiekiamas',
      details: message,
    });
  }
});

export default app;
